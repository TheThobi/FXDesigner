/**
 * Texture unit reserved for resource creation and uploads. Creating or updating a texture
 * requires binding it; doing so on a unit used by a render pass would silently replace that
 * pass's input. Samplers bound by passes use units 0..UPLOAD_UNIT-1.
 * (WebGL2 guarantees at least 16 fragment texture units.)
 */
export const UPLOAD_UNIT = 15;

/** Activates the upload unit; call before any bindTexture done for creation/upload. */
export function activateUploadUnit(gl: WebGL2RenderingContext): void {
  gl.activeTexture(gl.TEXTURE0 + UPLOAD_UNIT);
}
