// ---------------------------------------------------------------------------
// Character catalog for the "Chọn nhân vật" picker.
//
// Characters are drawn procedurally by <CharacterSprite />, so a character is
// just a small bundle of parameters — no image files, and a player's choice
// travels over the socket as a single id string.
// ---------------------------------------------------------------------------

export type EarShape =
  | 'cat'
  | 'rabbit'
  | 'bear'
  | 'mouse'
  | 'frog'
  | 'duck'
  | 'horn'
  | 'floppy'
  | 'none';

export type FaceExpression =
  | 'smile'
  | 'sleepy'
  | 'wink'
  | 'happy'
  | 'calm'
  | 'blush'
  | 'shock'
  | 'grin';

export interface CharacterDef {
  id: string;
  name: string;
  gender: 'male' | 'female';
  /** Head + body fur colour */
  fur: string;
  /** Muzzle / belly patch colour */
  patch: string;
  ear: EarShape;
  face: FaceExpression;
  /** Shirt colour */
  shirt: string;
}

interface Archetype {
  key: string;
  name: string;
  fur: string;
  patch: string;
  ear: EarShape;
}

// 24 animal archetypes; each gets a male and a female variant below.
const ARCHETYPES: Archetype[] = [
  { key: 'meo', name: 'Mèo Lười', fur: '#fbe3bf', patch: '#fff6e5', ear: 'cat' },
  { key: 'tho', name: 'Thỏ Bông', fur: '#f7f3ef', patch: '#ffe3ef', ear: 'rabbit' },
  { key: 'gau', name: 'Gấu Mập', fur: '#c89b72', patch: '#eacfb4', ear: 'bear' },
  { key: 'ech', name: 'Ếch Xanh', fur: '#8bd47c', patch: '#d9f3cf', ear: 'frog' },
  { key: 'vit', name: 'Vịt Vàng', fur: '#ffd95e', patch: '#fff0b8', ear: 'duck' },
  { key: 'cun', name: 'Cún Nâu', fur: '#b9834f', patch: '#f0dcc2', ear: 'floppy' },
  { key: 'chuot', name: 'Chuột Nhắt', fur: '#cfd3dc', patch: '#f2f4f8', ear: 'mouse' },
  { key: 'heo', name: 'Heo Hồng', fur: '#ffafc9', patch: '#ffd9e5', ear: 'mouse' },
  { key: 'cao', name: 'Cáo Cam', fur: '#f08b4c', patch: '#ffe3cc', ear: 'cat' },
  { key: 'truc', name: 'Gấu Trúc', fur: '#f4f4f6', patch: '#ffffff', ear: 'bear' },
  { key: 'ho', name: 'Hổ Con', fur: '#f5b041', patch: '#ffe6bd', ear: 'cat' },
  { key: 'cuu', name: 'Cừu Mây', fur: '#f3f0ea', patch: '#fffdf8', ear: 'floppy' },
  { key: 'khi', name: 'Khỉ Nghịch', fur: '#a9744f', patch: '#f0d2b0', ear: 'bear' },
  { key: 'bo', name: 'Bò Sữa', fur: '#f6f6f8', patch: '#ffd9e0', ear: 'floppy' },
  { key: 'nai', name: 'Nai Vàng', fur: '#d9a066', patch: '#f6e0c4', ear: 'horn' },
  { key: 'soi', name: 'Sói Xám', fur: '#8e97a8', patch: '#dfe4ec', ear: 'cat' },
  { key: 'muop', name: 'Mèo Mướp', fur: '#9aa3b2', patch: '#e8ecf3', ear: 'cat' },
  { key: 'canhcut', name: 'Cánh Cụt', fur: '#3c4557', patch: '#ffffff', ear: 'none' },
  { key: 'rua', name: 'Rùa Xanh', fur: '#6fc3a6', patch: '#d6f2e7', ear: 'none' },
  { key: 'ong', name: 'Ong Vàng', fur: '#ffcf47', patch: '#fff2c4', ear: 'horn' },
  { key: 'cu', name: 'Cú Đêm', fur: '#a88bbf', patch: '#ecdff5', ear: 'horn' },
  { key: 'hamster', name: 'Hamster', fur: '#f2c08a', patch: '#ffeedb', ear: 'mouse' },
  { key: 'soc', name: 'Sóc Nâu', fur: '#c87f5a', patch: '#f5ddc9', ear: 'mouse' },
  { key: 'ma', name: 'Ma Lanh', fur: '#eef0f6', patch: '#ffffff', ear: 'none' },
];

const MALE_SHIRTS = ['#5b8def', '#2bb673', '#f2994a', '#7b61ff', '#e05c5c', '#38b2ac'];
const FEMALE_SHIRTS = ['#ff8fc5', '#ffd166', '#9b8cff', '#64d2ff', '#ff9f7a', '#7ed7a5'];

const MALE_FACES: FaceExpression[] = ['smile', 'grin', 'calm', 'wink', 'happy', 'shock'];
const FEMALE_FACES: FaceExpression[] = ['blush', 'sleepy', 'happy', 'smile', 'wink', 'calm'];

function build(gender: 'male' | 'female'): CharacterDef[] {
  const shirts = gender === 'male' ? MALE_SHIRTS : FEMALE_SHIRTS;
  const faces = gender === 'male' ? MALE_FACES : FEMALE_FACES;
  return ARCHETYPES.map((a, i) => ({
    id: `${a.key}-${gender === 'male' ? 'm' : 'f'}`,
    name: a.name,
    gender,
    fur: a.fur,
    patch: a.patch,
    ear: a.ear,
    face: faces[i % faces.length],
    shirt: shirts[i % shirts.length],
  }));
}

export const CHARACTERS: CharacterDef[] = [...build('male'), ...build('female')];

export const CHARACTERS_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

export function charactersFor(gender: 'male' | 'female'): CharacterDef[] {
  return CHARACTERS.filter((c) => c.gender === gender);
}

export function getCharacter(id: string | undefined): CharacterDef {
  return (id && CHARACTERS_BY_ID.get(id)) || CHARACTERS[0];
}

// ---- Accessories ----------------------------------------------------------

export interface AccessoryDef {
  id: string;
  label: string;
}

export const ACCESSORIES: AccessoryDef[] = [
  { id: 'none', label: 'Không' },
  { id: 'party', label: 'Mũ tiệc' },
  { id: 'crown', label: 'Vương miện' },
  { id: 'sunglasses', label: 'Kính râm' },
  { id: 'headphones', label: 'Tai nghe' },
  { id: 'bunny', label: 'Tai thỏ' },
  { id: 'halo', label: 'Hào quang' },
  { id: 'horns', label: 'Sừng quỷ' },
  { id: 'bow', label: 'Nơ' },
  { id: 'flower', label: 'Vòng hoa' },
  { id: 'beanie', label: 'Mũ len' },
];

export function randomCharacter(gender: 'male' | 'female') {
  const pool = charactersFor(gender);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function randomAccessory() {
  return ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)];
}
