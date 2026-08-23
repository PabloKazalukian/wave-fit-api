import { isSimilar, normalizeString } from './string.utils';

describe('normalizeString', () => {
  it('convierte a minúsculas', () => {
    expect(normalizeString('PRESS DE BANCA')).toBe('press de banca');
  });

  it('elimina acentos', () => {
    expect(normalizeString('Curl de Bíceps')).toBe('curl de biceps');
    expect(normalizeString('Jalón al Pecho')).toBe('jalon al pecho');
  });

  it('elimina caracteres especiales', () => {
    expect(normalizeString('Press-banca (plano)')).toBe('pressbanca plano');
  });

  it('colapsa espacios múltiples y recorta extremos', () => {
    expect(normalizeString('  Press   de   banca  ')).toBe(
      'press de banca',
    );
  });

  it('retorna vacío para strings falsy', () => {
    expect(normalizeString('')).toBe('');
    expect(normalizeString(null as unknown as string)).toBe('');
    expect(normalizeString(undefined as unknown as string)).toBe('');
  });
});

describe('isSimilar', () => {
  it('retorna true para strings idénticos tras normalizar', () => {
    expect(isSimilar('Press Banca', 'press banca!')).toBe(true);
    expect(isSimilar('', '')).toBe(true);
  });

  it('retorna true dentro del umbral por defecto (<= 2)', () => {
    expect(isSimilar('Sentadilla Búlgara', 'Sentadilla Bulgar')).toBe(true);
    expect(isSimilar('Remo', 'Rema')).toBe(true);
  });

  it('retorna false fuera del umbral por defecto', () => {
    expect(isSimilar('Dominadas', 'Dominadas Lastradas')).toBe(false);
    expect(isSimilar('Press Banca', 'Press Militar')).toBe(false);
  });

  it('respeta el umbral personalizado', () => {
    expect(isSimilar('Remo', 'Rema', 0)).toBe(false);
    expect(isSimilar('Remo', 'Rema', 1)).toBe(true);
    expect(isSimilar('Remo', 'Remar', 2)).toBe(true);
  });

  it('bloquea similitud si contienen palabras opuestas: pull/push', () => {
    expect(isSimilar('Pull Up', 'Push Up')).toBe(false);
  });

  it('bloquea similitud si contienen palabras opuestas: inclinado/declinado', () => {
    expect(isSimilar('Press Inclinado', 'Press Declinado')).toBe(false);
  });

  it('bloquea similitud si contienen palabras opuestas: abduccion/aduccion', () => {
    expect(isSimilar('Abducción de cadera', 'Aducción de cadera')).toBe(false);
  });

  it('bloquea similitud si contienen palabras opuestas: extension/flexion', () => {
    expect(isSimilar('Extensión de tríceps', 'Flexión de tríceps')).toBe(false);
  });

  it('bloquea similitud si contienen palabras opuestas: abd/add cortos', () => {
    expect(isSimilar('Elevación Abd', 'Elevación Add')).toBe(false);
  });

  it('bloquea similitud si contienen palabras opuestas: barra/polea', () => {
    expect(isSimilar('Jalón Barra', 'Jalón Polea')).toBe(false);
  });

  it('no bloquea cuando la palabra clave opuesta aparece solo en un string', () => {
    // 'maquina' presente pero su opuesta 'libre' no → cae a Levenshtein
    expect(isSimilar('Press Maquina', 'Pres Maquina')).toBe(true);
  });

  it('es insensible a mayúsculas y acentos en ambas entradas', () => {
    expect(isSimilar('EXTENSIÓN', 'extension')).toBe(true);
  });
});
