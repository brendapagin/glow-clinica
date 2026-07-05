import { supabase } from './supabase';

const BUCKET = 'fotos-pacientes';

export async function enviarFoto(pacienteId, servicoSlug, tipo, arquivo) {
  const extensao = arquivo.name.split('.').pop();
  const caminho = `${pacienteId}/${servicoSlug}/${tipo}/${Date.now()}.${extensao}`;

  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo);
  if (erroUpload) throw erroUpload;

  const { error: erroRegistro } = await supabase.from('fotos').insert({
    paciente_id: pacienteId,
    servico_slug: servicoSlug,
    tipo,
    storage_path: caminho,
  });
  if (erroRegistro) throw erroRegistro;
}

export async function listarFotos(pacienteId, servicoSlug) {
  const { data, error } = await supabase
    .from('fotos')
    .select('id, tipo, storage_path, criado_em')
    .eq('paciente_id', pacienteId)
    .eq('servico_slug', servicoSlug)
    .order('criado_em', { ascending: false });

  if (error || !data) return [];

  const comUrl = await Promise.all(
    data.map(async (foto) => {
      const { data: assinada } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(foto.storage_path, 60 * 60); // 1 hora
      return { ...foto, url: assinada?.signedUrl };
    })
  );

  return comUrl;
}

export async function excluirFoto(id, storagePath) {
  await supabase.storage.from(BUCKET).remove([storagePath]);
  await supabase.from('fotos').delete().eq('id', id);
}
