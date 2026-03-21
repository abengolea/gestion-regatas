'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, CheckCircle } from 'lucide-react';

interface SubirComprobanteAppProps {
  viajeId: string;
  socioId: string;
  onSuccess?: () => void;
}

export function SubirComprobanteApp({ viajeId, socioId, onSuccess }: SubirComprobanteAppProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Seleccioná una imagen (JPG, PNG, etc.)');
      return;
    }

    setUploading(true);
    setDone(false);
    try {
      const form = new FormData();
      form.append('viajeId', viajeId);
      form.append('socioId', socioId);
      form.append('imagen', file);
      const res = await fetch('/api/pagos/comprobante', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (json.success) {
        setDone(true);
        onSuccess?.();
      } else {
        alert(json.message ?? 'Error al subir');
      }
    } catch {
      alert('Error al subir. Intentá de nuevo.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="outline"
        className="w-full"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : done ? (
          <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        {uploading
          ? 'Subiendo...'
          : done
            ? 'Comprobante enviado'
            : 'Seleccionar imagen'}
      </Button>
      {done && (
        <p className="text-sm text-muted-foreground">
          Recibimos tu comprobante. El admin lo revisará y te avisamos por WhatsApp.
        </p>
      )}
    </div>
  );
}
