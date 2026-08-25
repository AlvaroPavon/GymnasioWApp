export const MAX_CLASS_TYPE_IMAGE_BYTES = 4 * 1024 * 1024;

const MIME_TO_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const mimeFromName = (value = '') => {
  const path = String(value).split(/[?#]/, 1)[0].toLowerCase();
  if (/\.jpe?g$/.test(path)) return 'image/jpeg';
  if (/\.png$/.test(path)) return 'image/png';
  if (/\.webp$/.test(path)) return 'image/webp';
  return '';
};

export function prepareClassTypeImageAsset(asset, classTypeId) {
  const uri = typeof asset?.uri === 'string' ? asset.uri.trim() : '';
  if (!uri) throw new Error('No se pudo leer la imagen seleccionada.');

  const declaredMime = typeof asset?.mimeType === 'string'
    ? asset.mimeType.split(';', 1)[0].trim().toLowerCase()
    : '';
  const mimeType = declaredMime === 'image/jpg'
    ? 'image/jpeg'
    : declaredMime || mimeFromName(asset?.fileName || uri);

  if (!MIME_TO_EXTENSION[mimeType]) {
    throw new Error('Seleccioná una imagen JPG, PNG o WebP.');
  }

  const fileSize = Number(asset?.fileSize);
  if (Number.isFinite(fileSize) && fileSize > MAX_CLASS_TYPE_IMAGE_BYTES) {
    throw new Error('La imagen no puede superar los 4 MB.');
  }

  const selectedName = typeof asset?.fileName === 'string' ? asset.fileName.trim() : '';
  const name = selectedName || `class-type-${classTypeId}.${MIME_TO_EXTENSION[mimeType]}`;

  return {
    uri,
    name,
    type: mimeType,
    fileSize: Number.isFinite(fileSize) && fileSize >= 0 ? fileSize : null
  };
}
