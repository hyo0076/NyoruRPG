# References and notices

This engine is newly authored for the user's supplied Universal Narrative RPG v2.1 specification. The Story Dice validation, unbiased d100 rejection boundary, queue/scope concepts and RisuAI module packaging were consulted. The LongMemory 0.21.0 independent-provider, source-selection and preview/apply patterns were consulted. LongMemory itself, its tokenizer/PDF/embedding dependencies and memory hooks are not bundled or required.

`vendor/rpack_map.bin` is a copy of the existing workspace's RPack mapping used to encode/decode the Risu module container. The accompanying notices are preserved verbatim in `vendor/RPACK-LICENSE` and `vendor/RPACK-LICENSE-MIT`. Packaging validates a complete round trip. No RPack executable is loaded at runtime.

The original references remain outside this project, unchanged. Included source-document copies are the user's supplied requirements and reference notes. No rights are inferred for unrelated LongMemory dependencies.

Node.js is required for development/builds. Optional browser QA uses an externally installed Playwright/Chrome; neither is bundled into the distributable plugin.
