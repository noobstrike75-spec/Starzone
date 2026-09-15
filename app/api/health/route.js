export async function GET() {
  return Response.json({
    success: true,
    service: "StarZone API",
    version: "v1",
    status: "online",
    timestamp: new Date().toISOString(),
  });
}
