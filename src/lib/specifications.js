// Stable internal keys for attributes used by the public catalog. Existing
// editorial labels remain readable so old rows need no migration.
const labelsByKey = {
  storage: 'Armazenamento',
  color: 'Cor',
  condition: 'Condição',
  warranty: 'Garantia',
  sim_type: 'Chip/SIM',
  battery: 'Bateria',
};

const keysByLabel = Object.fromEntries(
  Object.entries(labelsByKey).map(([key, label]) => [label, key]),
);

export function specificationKey(value) {
  const key = String(value ?? '').trim();
  return keysByLabel[key] || key;
}

export function specificationLabel(value) {
  const key = String(value ?? '').trim();
  return labelsByKey[key] || key;
}
