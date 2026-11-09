# Reviewed publication false positives

The full pre-push gate blocks public manufacturer domains, one owner-supplied firmware reference and technical words in historical messages. Narrow contextual exceptions must permit these known public references while still rejecting private-domain neighbors, unrelated words, generic secrets and other denylist rules. No history rewrite or hook bypass. Acceptance: positive and negative regression cases, full gate pass, normal push and remote SHA verification.
