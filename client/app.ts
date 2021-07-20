import * as PIXI from "pixi.js";
import { RtagClient } from "./.rtag/client";
import { PlayerName, PlayerState } from "./.rtag/types";
import { Player } from "./Player";

const BUFFER_TIME = 140;

const players: Map<PlayerName, { player: Player; sprite: PIXI.Sprite }> = new Map();
const waterTexture = PIXI.Texture.from("water.png");
const shipTexture = PIXI.Texture.from("ship.png");

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
        const shipSprite = new PIXI.Sprite(shipTexture);
        shipSprite.anchor.set(0.5);
        app.stage.addChild(shipSprite);
        players.set(player.name, { player: new Player(player.name, player.location), sprite: shipSprite });
      } else {
        players.get(player.name)!.player.updateTarget(player.location, state.updatedAt + BUFFER_TIME);
      }
    });
  });

  const draw = () => {
    const now = Date.now();
    players.forEach(({ player, sprite }) => {
      const { x, y } = player.getCurrPos(now);
      if (x !== sprite.x && y !== sprite.y) {
        sprite.rotation = Math.atan2(y - sprite.y, x - sprite.x) - Math.PI / 2;
        sprite.x = x;
        sprite.y = y;
      }
    });
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);

  const app = new PIXI.Application();
  const waterSprite = new PIXI.TilingSprite(waterTexture, 800, 600);
  app.stage.addChild(waterSprite);
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
