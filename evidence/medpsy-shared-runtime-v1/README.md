# MedPsy shared-runtime evidence v1

This namespace is reserved for fresh evidence from the exact canonical MedPsy GGUF using pinned direct `llama.cpp`.

No remote run has been dispatched or published by Task 7. The committed files are producer definitions only; they are not passing model evidence.

The workflow freezes all inputs before inference, runs calibration before untouched holdouts without modifying producers, retains raw stdout and stderr, labels the remote-CI evidence tier and host, and removes GGUF and partial files before artifact upload. It also records the two public `metadata.json` profiler prompts separately from the product orchestration.

Itemized training lineage remains a disclosed risk under `config/model-license-decision.json`; it is not represented as an unpublished automatic ADTC failure. Named human clinical review and physical target-laptop evidence remain unresolved and cannot be satisfied by this workflow.
