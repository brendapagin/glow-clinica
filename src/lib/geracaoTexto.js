import { supabase } from './supabase';

export async function gerarTextoClinico({ tipo, servico, dados, pacienteNome }) {
  const { data, error } = await supabase.functions.invoke('gerar-texto-clinico', {
    body: { tipo, servico, dados, pacienteNome },
  });

  if (error || data?.error) {
    throw new Error(data?.error || error.message || 'Não foi possível gerar o texto.');
  }

  return data.texto;
}
