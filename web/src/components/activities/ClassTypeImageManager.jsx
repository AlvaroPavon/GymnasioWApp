import React, { useEffect, useState } from 'react';
import './activities.css';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 4 * 1024 * 1024;

function fileValidationMessage(file) {
  if (!ALLOWED_TYPES.has(file.type)) return 'Usa una imagen JPG, PNG o WebP.';
  if (file.size > MAX_FILE_SIZE) return 'La imagen no puede superar los 4 MB.';
  return '';
}

function CreateClassTypeCard({ onCreate }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [inputKey, setInputKey] = useState(0);
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

    const validationMessage = fileValidationMessage(nextFile);
    if (validationMessage) {
      setStatus({ kind: 'error', message: validationMessage });
      event.target.value = '';
      return;
    }

    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  };

  const submit = async (event) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName.length < 2 || !file) return;

    setStatus({ kind: 'loading', message: 'Creando actividad…' });
    try {
      await onCreate(normalizedName, file);
      setName('');
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      setInputKey((current) => current + 1);
      setStatus({ kind: 'success', message: 'Actividad creada. Sus nuevas clases usarán esta imagen automáticamente.' });
    } catch (error) {
      setStatus({ kind: 'error', message: error.message || 'No se pudo crear la actividad.' });
    }
  };

  return (
    <form className="class-type-create" onSubmit={submit}>
      <div className="class-type-create__copy">
        <p>Nueva actividad</p>
        <h3>Crear tipo e imagen</h3>
        <span>Por ejemplo, “Zumba”. Al seleccionarla al crear una clase, su imagen se asignará automáticamente.</span>
      </div>
      <div className="class-type-create__preview">
        {previewUrl ? <img src={previewUrl} alt="Vista previa de la nueva actividad" /> : <span>Vista previa</span>}
      </div>
      <div className="class-type-create__fields">
        <label>
          <span>Nombre de la actividad</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={80}
            placeholder="Zumba"
            required
          />
        </label>
        <label>
          <span>Imagen del calendario</span>
          <input key={inputKey} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} required />
        </label>
        <button type="submit" disabled={name.trim().length < 2 || !file || status.kind === 'loading'}>
          {status.kind === 'loading' ? 'Creando…' : 'Crear actividad'}
        </button>
        <p className={`upload-feedback upload-feedback--${status.kind}`} aria-live="polite">{status.message}</p>
      </div>
    </form>
  );
}

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
    const validationMessage = fileValidationMessage(nextFile);
    if (validationMessage) {
      setStatus({ kind: 'error', message: validationMessage });
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

export default function ClassTypeImageManager({ classTypes, onUpload, onCreate }) {
  return (
    <section className="class-type-images" aria-labelledby="class-type-images-heading">
      <div className="class-type-images__heading">
        <div>
          <p>Imágenes efectivas del calendario</p>
          <h2 id="class-type-images-heading">Imágenes por actividad</h2>
        </div>
        <span>JPG, PNG o WebP · máximo 4 MB</span>
      </div>

      <CreateClassTypeCard onCreate={onCreate} />

      {classTypes.length === 0 ? (
        <div className="activities-state">
          <strong>No hay tipos de clase configurados</strong>
          <p>Crea la primera actividad con el formulario anterior.</p>
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
