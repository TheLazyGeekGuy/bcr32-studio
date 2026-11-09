# Plan

Add a pure reviewed-public-match predicate used only for private denylist findings. Accept two exact manufacturer domain literals, one exact firmware repository URL, and complete technical words around the two overly broad substring patterns. Reject identifier/hostname suffixes. Keep generic scanning, binary metadata checks and commit identity checks unchanged. Test the predicate independently and run the complete gate.
