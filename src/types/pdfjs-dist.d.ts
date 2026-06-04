// Ambient declarations for pdfjs-dist's subpath ESM entrypoints, which ship
// without bundled type declarations. The contract-template editor imports them
// dynamically and treats the module as `any`; these stubs satisfy the compiler
// without pulling in types pdfjs-dist does not provide for these paths.
declare module "pdfjs-dist/build/pdf.mjs";
declare module "pdfjs-dist/legacy/build/pdf.mjs";
