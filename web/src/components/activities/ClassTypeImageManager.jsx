import React, { useEffect, useState } from 'react';
import './activities.css';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 4 * 1024 * 1024;

function ClassTypeImageCard({ classType, onUpload }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [status, setStatus] = useState({ kind: 'idle', message: '' });

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectFile = (event) => {
    const nextFile = event.target.files?.[0] || null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setFile(null);
    setStatus({ kind: 'idle', message: '' });

    if (!nextFile) return;
    if (!ALLOWED_TYPES.has(nextFile.type)) {
      setStatus({ kind: 'error', message: 'Usa una imagen JPG, PNG o WebP.' });
      event.target.value = '';
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setStatus({ kind: 'error', message: 'La imagen no puede superar los 4 MB.' });
      event.target.value = '';
      return;
    }

    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!file) return;
    const form = event.currentTarget;
    setStatus({ kind: 'loading', message: 'Subiendo imagen…' });
    try {
      await onUpload(classType.id, file);
      setStatus({ kind: 'success', message: 'Imagen actualizada correctamente.' });
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      form.reset();
    } catch (error) {
      setStatus({ kind: 'error', message: error.message || 'No se pudo actualizar la imagen.' });
    }
  };

  const imageUrl = previewUrl || classType.imageUrl || classType.image_url;

  return (
    <form className="class-type-image-card" onSubmit={submit}>
      <div className="class-type-image-card__preview">
        {imageUrl ? (
          <img src={imageUrl} alt={previewUrl ? `Vista previa de ${classType.name}` : `Imagen de ${classType.name}`} />
        ) : (
          <p>Sin imagen asignada</p>
        )}
      </div>
      <div className="class-type-image-card__body">
        <h3>{classType.name || classType.nombre}</h3>
        <label>
          <span>{classType.imageUrl || classType.image_url ? 'Reemplazar imagen' : 'Seleccionar imagen'}</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} />
        </label>
        <button type="submit" disabled={!file || status.kind === 'loading'}>
          {status.kind === 'loading' ? 'Guardando…' : 'Guardar imagen'}
        </button>
        <p className={`upload-feedback upload-feedback--${status.kind}`} aria-live="polite">{status.message}</p>
      </div>
    </form>
  );
}

export default function ClassTypeImageManager({ classTypes, onUpload }) {
  return (
    <section className="class-type-images" aria-labelledby="class-type-images-heading">
      <div className="class-type-images__heading">
        <div>
          <p>Imágenes efectivas del calendario</p>
          <h2 id="class-type-images-heading">Imágenes por actividad</h2>
        </div>
        <span>JPG, PNG o WebP · máximo 4 MB</span>
      </div>

      {classTypes.length === 0 ? (
        <div className="activities-state">
          <strong>No hay tipos de clase configurados</strong>
          <p>Creá un tipo de actividad antes de asignarle una imagen.</p>
        </div>
      ) : (
        <div className="class-type-images__grid">
          {classTypes.map((classType) => (
            <ClassTypeImageCard key={classType.id} classType={classType} onUpload={onUpload} />
          ))}
        </div>
      )}
    </section>
  );
}
