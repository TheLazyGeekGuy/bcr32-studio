# SDK NodeNext declaration regression

CI fails TS2834 when consuming exported value-domain declarations. Reproduced locally at 05ee0346d9b21eca92695f8c61f67ca2a25972e3. All relative module specifiers emitted into declarations must resolve as ESM. Acceptance: actual standalone SDK generation and NodeNext consumer smoke pass, existing tests and build pass.
