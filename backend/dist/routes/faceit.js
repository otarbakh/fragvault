"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.faceitRoutes = faceitRoutes;
async function faceitRoutes(app) {
    app.get('/faceit/verify/:username', async (req, reply) => {
        const { username } = req.params;
        const apiKey = process.env.FACEIT_API_KEY;
        if (!apiKey) {
            return reply.status(500).send({ error: 'FACEIT_API_KEY not configured' });
        }
        let data;
        try {
            const res = await fetch(`https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(username)}&game=cs2`, { headers: { Authorization: `Bearer ${apiKey}` } });
            if (res.status === 404) {
                return reply.status(404).send({ error: 'Player not found' });
            }
            if (!res.ok) {
                return reply.status(502).send({ error: 'FaceIT API error' });
            }
            data = (await res.json());
        }
        catch {
            return reply.status(502).send({ error: 'Failed to reach FaceIT API' });
        }
        const games = data.games;
        const cs2 = games?.cs2;
        return reply.send({
            verified: true,
            nickname: data.nickname,
            avatar: data.avatar ?? '',
            skillLevel: cs2?.skill_level ?? 0,
            elo: cs2?.faceit_elo ?? 0,
        });
    });
}
//# sourceMappingURL=faceit.js.map