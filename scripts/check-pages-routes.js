const DEFAULT_BASE_URL = "https://quietbriony.github.io/world-toto-lab";

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function buildUrl(baseUrl, pathname, query) {
  const url = new URL(`${trimTrailingSlash(baseUrl)}${pathname}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value == null || value === "") {
      return;
    }

    url.searchParams.set(key, value);
  });

  return url.toString();
}

async function checkUrl(url) {
  const response = await fetch(url, {
    redirect: "follow",
  });

  return {
    ok: response.ok,
    status: response.status,
    url,
  };
}

async function main() {
  const baseUrl = trimTrailingSlash(
    process.env.WORLD_TOTO_LAB_BASE_URL || DEFAULT_BASE_URL,
  );
  const roundId = process.env.WORLD_TOTO_LAB_ROUND_ID || "";
  const userId = process.env.WORLD_TOTO_LAB_USER_ID || "";

  const routes = [
    buildUrl(baseUrl, "/", {}),
    buildUrl(baseUrl, "/dev-playbook/", {}),
    buildUrl(baseUrl, "/big-carryover/", {}),
    buildUrl(baseUrl, "/goal3-value/", {}),
    buildUrl(baseUrl, "/big-carryover/", {
      eventType: "carryover_event",
      label: "BIG 高還元イベント",
      sales: "8000000000",
      carryover: "3000000000",
      returnRate: "50",
      snapshotDate: "2026-04-21",
      spend: "10000",
      sourceUrl: "https://www.toto-dream.com/big/",
    }),
  ];

  if (roundId) {
    routes.push(
      buildUrl(baseUrl, "/workspace/", { round: roundId }),
      buildUrl(baseUrl, "/workspace/", { debug: "1", round: roundId }),
      buildUrl(baseUrl, "/official-schedule-import/", { round: roundId }),
      buildUrl(baseUrl, "/fixture-selector/", { round: roundId }),
      buildUrl(baseUrl, "/toto-official-round-import/", { round: roundId }),
      buildUrl(baseUrl, "/toto-official-round-import/", {
        round: roundId,
        autoApply: "1",
        autoSync: "1",
        productType: "winner",
        sourcePreset: "toto_official_detail",
      }),
      buildUrl(baseUrl, "/picks/", { round: roundId, user: userId || undefined }),
      buildUrl(baseUrl, "/scout-cards/", { round: roundId, user: userId || undefined }),
      buildUrl(baseUrl, "/match-editor/", { round: roundId }),
      buildUrl(baseUrl, "/simple-view/", { round: roundId, user: userId || undefined }),
      buildUrl(baseUrl, "/pick-room/", { round: roundId, user: userId || undefined }),
      buildUrl(baseUrl, "/play/", { round: roundId, user: userId || undefined }),
      buildUrl(baseUrl, "/practice-lab/", { round: roundId }),
      buildUrl(baseUrl, "/winner-value/", { round: roundId, user: userId || undefined }),
      buildUrl(baseUrl, "/consensus/", { round: roundId }),
      buildUrl(baseUrl, "/edge-board/", { round: roundId }),
      buildUrl(baseUrl, "/review/", { round: roundId }),
      buildUrl(baseUrl, "/ticket-generator/", { round: roundId }),
    );
  }

  console.log("[world-toto-lab] pages route check");
  console.log(`baseUrl=${baseUrl}`);
  if (roundId) {
    console.log(`roundId=${roundId}`);
  } else {
    console.log("roundId=<not set>");
    console.log("note=round が必要な画面は WORLD_TOTO_LAB_ROUND_ID を入れたときだけ確認します");
  }
  if (userId) {
    console.log(`userId=${userId}`);
  }
  console.log("");

  const results = [];
  for (const url of routes) {
    try {
      results.push(await checkUrl(url));
    } catch (error) {
      results.push({
        ok: false,
        status: "ERR",
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let failureCount = 0;
  for (const result of results) {
    const status = result.ok ? "OK" : "NG";
    const detail = result.error ? ` // ${result.error}` : "";
    console.log(`${status} ${String(result.status).padEnd(3)} ${result.url}${detail}`);
    if (!result.ok) {
      failureCount += 1;
    }
  }

  console.log("");
  console.log(`failures: ${failureCount}`);

  if (failureCount > 0) {
    process.exit(1);
  }
}

void main();
