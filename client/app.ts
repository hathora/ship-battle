import * as PIXI from "pixi.js";
import { RtagClient } from "./.rtag/client";
import { PlayerName, PlayerState } from "./.rtag/types";
import { Player } from "./Player";

const BUFFER_TIME = 140;

const players: Map<PlayerName, { player: Player; gr: PIXI.Graphics }> = new Map();

setupApp().then((view) => {
  document.body.appendChild(view);
});

async function setupApp() {
  if (sessionStorage.getItem("token") === null) {
    sessionStorage.setItem("token", await RtagClient.loginAnonymous());
  }
  const token = sessionStorage.getItem("token")!;

  const client = await getClient(token, (state) => {
    state.board.forEach((player) => {
      if (!players.has(player.name)) {
        const gr = new PIXI.Graphics();
        gr.beginFill(0xffffff);
        gr.drawCircle(0, 0, 30);
        gr.endFill();
        app.stage.addChild(gr);
        players.set(player.name, { player: new Player(player.name, player.location), gr });
      } else {
        players.get(player.name)!.player.updateTarget(player.location, state.updatedAt + BUFFER_TIME);
      }
    });
  });

  const draw = () => {
    const now = Date.now();
    players.forEach(({ player, gr }) => {
      const { x, y } = player.getCurrPos(now);
      gr.x = x;
      gr.y = y;
    });
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);

  const app = new PIXI.Application({ resizeTo: window });
  app.renderer.view.addEventListener("pointerdown", (e) => {
    client.updateTarget({ target: { x: e.offsetX, y: e.offsetY } });
  });
  return app.view;
}

async function getClient(token: string, onStateChange: (state: PlayerState) => void) {
  if (window.location.pathname.length > 1) {
    const stateId = window.location.pathname.split("/").pop()!;
    return RtagClient.connectExisting(import.meta.env.VITE_APP_ID, token, stateId, onStateChange);
  } else {
    const { stateId, client } = await RtagClient.connectNew(import.meta.env.VITE_APP_ID, token, {}, onStateChange);
    window.history.pushState({}, "", `/${stateId}`);
    return client;
  }
}
