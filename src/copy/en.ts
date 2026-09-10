import type { CopyDict } from '@/copy/tr';

/** English dictionary — must match tr.ts KEY FOR KEY (checked at compile time via the CopyDict type). */
export const en: CopyDict = {
  appName: 'Plantie',

  cameraHint: 'Frame a leaf or flower.',
  cameraPermissionDenied: 'Camera access denied. You can still pick a photo from your gallery.',
  cameraPermissionChecking: 'Checking camera permission…',
  blurry: 'This photo is too blurry. Move a bit closer, let it focus, then try again.',
  retry: 'Try again',
  emptyCollection: "You haven't found any plants yet. Find your first one.",
  findPlant: 'Find a plant',
  shutterA11y: 'Take photo',
  galleryA11y: 'Choose from gallery',
  collectionA11y: 'Collection',
  gallery: 'Gallery',
  collection: 'Collection',

  // Identification pipeline
  notAPlant: "I couldn't see a plant in this frame. Frame a leaf or flower.",
  errorNetwork: "No internet connection. Check your connection and try again.",
  errorService: "Identification isn't available right now. Try again shortly.",
  errorQuota: "Today's identification limit is reached. You can try again tomorrow.",
  addToCollection: 'Add to collection',
  lowConfidenceIntro: "I'm not sure yet. A close-up of the leaf could help me narrow it down.",
  lowConfidenceExhausted: "I still couldn't be sure with the second photo. Want to try a clearer angle?",
  visualDisagreement: "The photo and the species guess didn't fully agree, so I lowered my confidence.",
  duplicateSpecies: 'This species is already in your collection — added anyway, counted as a separate find.',
  backToCamera: 'Back to camera',
  giveUp: 'Cancel',
  giveUpA11y: 'Cancel, back to camera',

  // Scan stages — describe the REAL pipeline steps, never made up.
  stagePreparing: 'Preparing photo…',
  stageClassifying: 'Searching the plant database…',
  stageVerifying: 'Verifying visual features…',
  stageAdjudicating: 'Taking a second look to be sure…',
  stageSaving: 'Adding to your collection…',

  confidenceHigh: 'High confidence',
  confidenceMedium: 'Medium confidence',
  confidenceLow: 'Low confidence',
  chooseOrgan: 'Which part are you photographing?',
  organLeaf: 'Leaf',
  organFlower: 'Flower',
  organFruit: 'Fruit',
  organBark: 'Bark',
  plantnetAttribution: 'Plant identification is powered by the Pl@ntNet recognition API (my.plantnet.org).',
  careWater: 'Water',
  careLight: 'Light',
  careSoil: 'Soil',
  carePets: 'Pets',
  toxicToPets: 'May be harmful to pets.',

  // Collection
  collectionTitle: 'Collection',
  speciesDiscovered: (n: number) => `${n} species discovered`,
  dragToReorder: 'Press and hold to reorder.',
  close: 'Close',
  delete: 'Delete',
  recordNotFound: 'Record not found.',
  stickerGenerationFailed: 'Sticker could not be generated.',

  // Welcome screen
  welcomeTagline: 'Identify plants, grow your sticker collection.',
  yourCollection: 'Your collection',
  seeAll: 'See all',
  mockMonstera: 'Monstera',
  mockFiddleLeaf: 'Fiddle-leaf fig',
  mockSnakePlant: 'Snake plant',
  mockAloe: 'Aloe vera',

  // Language
  languageTurkish: 'Türkçe',
  languageEnglish: 'English',
  taglineDiscover: 'Discover your plant',
  taglineIdentify: 'Identify plants',
  taglineGrow: 'Grow your collection',
  taglineCollect: 'Collect your stickers',

  // Per-plant chat
  askAboutPlant: 'Ask about this plant',
  chatIntro: 'Ask anything about this plant — care, light, watering.',
  chatPlaceholder: 'Ask a question…',
  chatSendA11y: 'Send',
  chatThinking: 'Thinking…',
  chatDisclaimer: 'Answers are AI-generated and can be wrong.',
  chatSuggestionWater: 'How often should I water it?',
  chatSuggestionLight: 'How much light does it need?',
  chatSuggestionPets: 'Is it safe for pets?',
  chatClear: 'Clear chat',
};
