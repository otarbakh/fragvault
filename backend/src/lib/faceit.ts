const BASE = 'https://open.faceit.com';

function apiKey(): string {
  const key = process.env.FACEIT_API_KEY;
  if (!key) throw new Error('FACEIT_API_KEY not configured');
  return key;
}

export async function getFaceitPlayerId(nickname: string): Promise<string> {
  const res = await fetch(
    `${BASE}/data/v4/players?nickname=${encodeURIComponent(nickname)}`,
    { headers: { Authorization: `Bearer ${apiKey()}` } },
  );
  if (!res.ok) {
    throw new Error(`FaceIT API error ${res.status} for player "${nickname}"`);
  }
  const data = (await res.json()) as { player_id?: string };
  if (!data.player_id) throw new Error(`No player_id for "${nickname}"`);
  return data.player_id;
}

export async function createFaceitMatch(opts: {
  lobbyId: string;
  teamAFaceitIds: string[];
  teamBFaceitIds: string[];
}): Promise<{ matchId: string; matchUrl: string; status: string }> {
  const organizerId = process.env.FACEIT_ORGANIZER_ID;
  if (!organizerId) throw new Error('FACEIT_ORGANIZER_ID not configured');

  const res = await fetch(`${BASE}/organizer/v1/matches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organizer_id: organizerId,
      game: 'cs2',
      competition_type: 'SCRIM',
      max_players: 10,
      min_players: 10,
      factions: {
        faction1: {
          name: 'Team A',
          roster: opts.teamAFaceitIds.map((id) => ({ player_id: id })),
        },
        faction2: {
          name: 'Team B',
          roster: opts.teamBFaceitIds.map((id) => ({ player_id: id })),
        },
      },
      metadata: { lobby_id: opts.lobbyId },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FaceIT match creation failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    match_id: string;
    faceit_url?: string;
    status: string;
  };

  return {
    matchId: data.match_id,
    matchUrl:
      data.faceit_url ??
      `https://www.faceit.com/en/cs2/room/${data.match_id}`,
    status: data.status,
  };
}
