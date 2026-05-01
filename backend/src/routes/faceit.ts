import type { FastifyInstance } from 'fastify';

export async function faceitRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { username: string } }>('/faceit/verify/:username', async (req, reply) => {
    const { username } = req.params;
    const apiKey = process.env.FACEIT_API_KEY;

    if (!apiKey) {
      return reply.status(500).send({ error: 'FACEIT_API_KEY not configured' });
    }

    let data: Record<string, unknown>;
    try {
      const res = await fetch(
        `https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(username)}&game=cs2`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );

      if (res.status === 404) {
        return reply.status(404).send({ error: 'Player not found' });
      }
      if (!res.ok) {
        return reply.status(502).send({ error: 'FaceIT API error' });
      }

      data = (await res.json()) as Record<string, unknown>;
    } catch {
      return reply.status(502).send({ error: 'Failed to reach FaceIT API' });
    }

    const games = data.games as Record<string, { skill_level: number; faceit_elo: number }> | undefined;
    const cs2 = games?.cs2;

    return reply.send({
      verified: true,
      nickname: data.nickname as string,
      avatar: (data.avatar as string) ?? '',
      skillLevel: cs2?.skill_level ?? 0,
      elo: cs2?.faceit_elo ?? 0,
    });
  });
}
