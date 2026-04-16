// ── Message DTO ──
export const toMessageResponseDTO = (message) => ({
  message
});

// ── Upload afbeelding DTO ──
export const toUploadAfbeeldingResponseDTO = (url) => ({
  message: 'Afbeelding opgeslagen!',
  url
});