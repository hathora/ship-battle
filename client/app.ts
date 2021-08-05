import * as PIXI from "pixi.js";
import { RtagClient } from "./.rtag/client";
import { PlayerState, Rotation } from "./.rtag/types";
import { Entity } from "./Entity";

const BUFFER_TIME = 140;

const client = new RtagClient(import.meta.env.VITE_APP_ID);

const entities: Map<string, { entity: Entity; sprite: PIXI.Sprite }> = new Map();
const waterTexture = PIXI.Texture.from("water.png");
const shipTexture = PIXI.Texture.from("ship.png");
const cannonBallTexure = PIXI.Texture.from("cannonBall.png");

setupApp().then((view) => {
  document.body.appendChild(view);
});

async function setupApp() {
  if (sessionStorage.getItem("token") === null) {
    sessionStorage.setItem("token", await client.loginAnonymous());
  }
  const token = sessionStorage.getItem("token")!;

  const app = new PIXI.Application();
  const background = new PIXI.TilingSprite(waterTexture, 800, 600);
  app.stage.addChild(background);

  const connection = await getClient(token, (state) => {
    state.ships.forEach((ship) => {
      if (!entities.has(ship.player)) {
        const sprite = new PIXI.Sprite(shipTexture);
        sprite.anchor.set(0.5);
        app.stage.addChild(sprite);
        entities.set(ship.player, { entity: new Entity(ship.location, ship.angle), sprite });
      } else {
        entities.get(ship.player)!.entity.updateTarget(ship.location, ship.angle, state.updatedAt + BUFFER_TIME);
      }
    });
    state.cannonBalls.forEach((cannonBall) => {
      if (!entities.has(cannonBall.id)) {
        const sprite = new PIXI.Sprite(cannonBallTexure);
        sprite.anchor.set(0.5);
        app.stage.addChild(sprite);
        entities.set(cannonBall.id, { entity: new Entity(cannonBall.location, cannonBall.angle), sprite });
      } else {
        entities
          .get(cannonBall.id)!
          .entity.updateTarget(cannonBall.location, cannonBall.angle, state.updatedAt + BUFFER_TIME);
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      connection.setRotation({ rotation: Rotation.RIGHT });
    } else if (e.key === "ArrowLeft") {
      connection.setRotation({ rotation: Rotation.LEFT });
    } else if (e.key === "ArrowUp") {
      connection.setRotation({ rotation: Rotation.FORWARD });
    } else if (e.key === " ") {
      connection.fireCannon({});
    }
  });

  app.ticker.add(() => {
    const now = Date.now();
    entities.forEach(({ entity, sprite }) => {
      const { location, angle } = entity.getCurrPos(now);
      sprite.rotation = angle - Math.PI / 2;
      sprite.x = location.x;
      sprite.y = location.y;
    });
  });

  return app.view;
}

async function getClient(token: string, onStateChange: (state: PlayerState) => void) {
  if (window.location.pathname.length > 1) {
    const stateId = window.location.pathname.split("/").pop()!;
    return client.connectExisting(token, stateId, onStateChange);
  } else {
    const connection = await client.connectNew(token, {}, onStateChange);
    window.history.pushState({}, "", `/${connection.stateId}`);
    return connection;
  }
}
