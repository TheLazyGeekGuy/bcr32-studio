#!/usr/bin/env python3
"""Independent SXM byte renderer, Python stdlib only. No MIDI or network operations.

This is a reference encoder for the published vectors, not a complete JSON Schema
validator. Validate arbitrary files against the schema and semantic contract first.
"""
import argparse
import json
from pathlib import Path


def pairs(items):
    result = {}
    for key, value in items:
        if key in result or key in ("__proto__", "constructor", "prototype"):
            raise ValueError("duplicate or forbidden key")
        result[key] = value
    return result


def read(path):
    raw = Path(path).read_bytes()
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError("file exceeds 2 MiB")
    return json.loads(raw.decode("utf-8-sig"), object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite JSON")))


def bounded(value, lo, hi):
    if type(value) is not int or not lo <= value <= hi:
        raise ValueError(f"integer {lo}..{hi} required")
    return value


def render(doc, device_id, parameter_id, value, fields):
    if doc["format"] != "SysEx Map" or doc["version"] != "1.0" or doc.get("requiredExtensions"):
        raise ValueError("unsupported SXM format or required extension")
    device = next(d for d in doc["devices"] if d["id"] == device_id)
    p = next(p for p in device["parameters"] if p["id"] == parameter_id)
    bounded(value, p["value"]["minimum"], p["value"]["maximum"])
    if set(fields) - set(p["fields"]):
        raise ValueError("unknown field")
    resolved = {key: bounded(fields.get(key, f["default"]), f["minimum"], f["maximum"])
                for key, f in p["fields"].items()}
    messages = []
    for message in p["messages"]:
        output = []
        for token in message["bytes"]:
            if type(token) is int:
                byte = token
            elif "field" in token:
                byte = resolved[token["field"]] + token["add"]
            elif "value" in token:
                t = token["value"]
                byte = ((value + t["add"]) // (2 ** t["shift"])) % (2 ** t["bits"])
            elif "checksum" in token:
                c = token["checksum"]
                if not 0 <= c["from"] <= c["to"] < len(output):
                    raise ValueError("checksum range must precede its byte")
                span = output[c["from"]:c["to"] + 1]
                if c["algorithm"] == "sum7":
                    byte = sum(span) % 128
                elif c["algorithm"] == "complement7":
                    byte = -sum(span) % 128
                elif c["algorithm"] == "xor7":
                    byte = 0
                    for b in span:
                        byte ^= b
                    byte &= 127
                else:
                    raise ValueError("unknown checksum")
            else:
                raise ValueError("unknown token")
            if output and len(output) != len(message["bytes"]) - 1:
                bounded(byte, 0, 127)
            output.append(byte)
        if output[0] != 240 or output[-1] != 247:
            raise ValueError("F0/F7 framing required")
        messages.append(output)
    return messages


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", nargs="?")
    parser.add_argument("--device")
    parser.add_argument("--parameter")
    parser.add_argument("--value", type=int)
    parser.add_argument("--field", action="append", default=[])
    parser.add_argument("--vectors")
    args = parser.parse_args()
    if args.vectors:
        vectors = Path(args.vectors)
        result = [render(read(vectors.parent / v["file"]), v["device"], v["parameter"],
                         v["value"], v.get("fields", {})) for v in read(vectors)]
    else:
        fields = {k: int(v) for k, v in (x.split("=", 1) for x in args.field)}
        result = render(read(args.file), args.device, args.parameter, args.value, fields)
    print(json.dumps(result, separators=(",", ":")))
