export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("Content-Length")) > limit) return null;
  let received = 0;
  const oversized = new Error("Request exceeds the upload limit.");
  const body = request.body?.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > limit) controller.error(oversized);
        else controller.enqueue(chunk);
      },
    }),
  );
  const response = new Response(body, {
    headers: { "Content-Type": request.headers.get("Content-Type") || "" },
  });
  return response.blob().catch((error) => {
    if (error === oversized) return null;
    throw error;
  });
}
