/**
 * Dictionary shape — tr.ts and en.ts both implement this interface. Not
 * `typeof tr`: `as const` would pin every field to a string literal type,
 * turning en.ts's (valid, just different) English text into a compile error.
 */
export interface CopyDict {
  appName: string;
  cameraHint: string;
  cameraPermissionDenied: string;
  cameraPermissionChecking: string;
  blurry: string;
  retry: string;
  emptyCollection: string;
  findPlant: string;
  shutterA11y: string;
  galleryA11y: string;
  collectionA11y: string;
  gallery: string;
  collection: string;
  notAPlant: string;
  errorNetwork: string;
  errorService: string;
  errorQuota: string;
  addToCollection: string;
  lowConfidenceIntro: string;
  lowConfidenceExhausted: string;
  visualDisagreement: string;
  duplicateSpecies: string;
  backToCamera: string;
  giveUp: string;
  giveUpA11y: string;
  stagePreparing: string;
  stageClassifying: string;
  stageVerifying: string;
  stageAdjudicating: string;
  stageSaving: string;
  confidenceHigh: string;
  confidenceMedium: string;
  confidenceLow: string;
  chooseOrgan: string;
  organLeaf: string;
  organFlower: string;
  organFruit: string;
  organBark: string;
  plantnetAttribution: string;
  careWater: string;
  careLight: string;
  careSoil: string;
  carePets: string;
  toxicToPets: string;
  collectionTitle: string;
  speciesDiscovered: (n: number) => string;
  dragToReorder: string;
  close: string;
  delete: string;
  recordNotFound: string;
  stickerGenerationFailed: string;
  welcomeTagline: string;
  yourCollection: string;
  seeAll: string;
  mockMonstera: string;
  mockFiddleLeaf: string;
  mockSnakePlant: string;
  mockAloe: string;
  languageTurkish: string;
  languageEnglish: string;
  taglineDiscover: string;
  taglineIdentify: string;
  taglineGrow: string;
  taglineCollect: string;
  askAboutPlant: string;
  chatIntro: string;
  chatPlaceholder: string;
  chatSendA11y: string;
  chatThinking: string;
  chatSuggestionWater: string;
  chatSuggestionLight: string;
  chatSuggestionPets: string;
  chatClear: string;
}

/**
 * Turkish dictionary. ALL app text comes from here or its en.ts counterpart
 * — no component has a bare string (see src/copy/useCopy.ts). Sentence case,
 * no ALL CAPS, no emoji, error messages phrased as "what happened + what to do."
 */
export const tr: CopyDict = {
  appName: 'Plantie',

  cameraHint: 'Yaprağı veya çiçeği çerçeveye al.',
  cameraPermissionDenied: 'Kameraya izin verilmedi. Galeriden fotoğraf seçebilirsin.',
  cameraPermissionChecking: 'Kamera izni kontrol ediliyor…',
  blurry: 'Fotoğraf net değil. Bitkiye biraz yaklaş ve odaklandıktan sonra tekrar dene.',
  retry: 'Tekrar dene',
  emptyCollection: 'Henüz çıkartman yok. İlk bitkini bul.',
  findPlant: 'Bitki bul',
  shutterA11y: 'Fotoğraf çek',
  galleryA11y: 'Galeriden seç',
  collectionA11y: 'Koleksiyon',
  gallery: 'Galeri',
  collection: 'Koleksiyon',

  // Identification pipeline
  notAPlant: 'Bu karede bitki göremedim. Yaprağı veya çiçeği çerçeveye al.',
  errorNetwork: 'İnternet bağlantısı yok. Bağlantını kontrol edip tekrar dene.',
  errorService: 'Şu anda tanımlama yapılamıyor. Birazdan tekrar dene.',
  errorQuota: 'Günlük tanımlama hakkı doldu. Yarın tekrar deneyebilirsin.',
  addToCollection: 'Koleksiyona ekle',
  lowConfidenceIntro: 'Emin değilim. Yaprağın yakın çekimini eklersen daralttırabilirim.',
  lowConfidenceExhausted: 'İkinci fotoğrafla da emin olamadım. Daha net bir açıdan tekrar dener misin?',
  visualDisagreement: 'Fotoğraf ile tür tahmini birbirini tam doğrulamadı, bu yüzden güveni bir kademe düşürdüm.',
  duplicateSpecies: 'Bu tür koleksiyonunda zaten var — yine de eklendi, ayrı bir keşif olarak sayıldı.',
  backToCamera: 'Kameraya dön',
  giveUp: 'Vazgeç',
  giveUpA11y: 'Vazgeç, kameraya dön',

  // Scan stages — describe pipeline.ts's REAL steps, not fabricated ones.
  stagePreparing: 'Fotoğraf hazırlanıyor…',
  stageClassifying: 'Bitki veritabanında aranıyor…',
  stageVerifying: 'Görsel özellikler doğrulanıyor…',
  stageAdjudicating: 'Emin olmak için tekrar bakılıyor…',
  stageSaving: 'Koleksiyona ekleniyor…',

  // Güven rozeti etiketleri — tür adı artık çekince taşımıyor, bu etiketler taşıyor.
  // Yalnızca NE KADAR emin olduğumuzu söyler, NEDEN'i değil: hangi servisin
  // katkı verdiği kullanıcıya gösterilmeyen bir uygulama detayı.
  confidenceHigh: 'Yüksek güven',
  confidenceMedium: 'Orta güven',
  confidenceLow: 'Düşük güven',
  chooseOrgan: 'Hangi kısmı çekiyorsun?',
  organLeaf: 'Yaprak',
  organFlower: 'Çiçek',
  organFruit: 'Meyve',
  organBark: 'Gövde',
  plantnetAttribution: 'Bitki tanımlama Pl@ntNet tanıma API’si ile yapılmaktadır (my.plantnet.org).',
  careWater: 'Su',
  careLight: 'Işık',
  careSoil: 'Toprak',
  carePets: 'Evcil hayvanlar',
  toxicToPets: 'Evcil hayvanlara zararlı olabilir.',

  // Collection
  collectionTitle: 'Koleksiyon',
  speciesDiscovered: (n: number) => `${n} tür keşfedildi`,
  dragToReorder: 'Sıralamak için basılı tutup sürükle.',
  close: 'Kapat',
  delete: 'Sil',
  recordNotFound: 'Kayıt bulunamadı.',
  stickerGenerationFailed: 'Sticker üretilemedi.',

  // Welcome screen
  welcomeTagline: 'Bitkileri tanı, çıkartma koleksiyonunu büyüt.',
  yourCollection: 'Koleksiyonun',
  seeAll: 'Tümünü gör',
  mockMonstera: 'Monstera',
  mockFiddleLeaf: 'Keman yaprağı',
  mockSnakePlant: 'Paşa kılıcı',
  mockAloe: 'Sarısabır',

  // Language
  languageTurkish: 'Türkçe',
  languageEnglish: 'English',

  // Loading screen rotating taglines
  taglineDiscover: 'Bitkini keşfet',
  taglineIdentify: 'Bitkileri tanı',
  taglineGrow: 'Koleksiyonunu büyüt',
  taglineCollect: 'Çıkartmalarını topla',

  // Bitkiye özel sohbet
  askAboutPlant: 'Bu bitki hakkında sor',
  chatIntro: 'Bu bitki hakkında merak ettiğini sor — bakım, ışık, sulama.',
  chatPlaceholder: 'Bir şey sor…',
  chatSendA11y: 'Gönder',
  chatThinking: 'Yanıt yazılıyor…',
  chatSuggestionWater: 'Ne sıklıkla sulamalıyım?',
  chatSuggestionLight: 'Ne kadar ışık ister?',
  chatSuggestionPets: 'Evcil hayvanlar için güvenli mi?',
  chatClear: 'Sohbeti temizle',
};
