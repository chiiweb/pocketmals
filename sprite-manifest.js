// Add a species entry only after its matching PNG files are committed.
// Example: { Kangol: ['front', 'back'] } enables Kangol-front.png and Kangol-back.png.
// Keeping the manifest explicit prevents unnecessary missing-file requests.
export const MAL_SPRITE_MANIFEST = Object.freeze({});
