import { Texture, Application, Sprite, AnimatedSprite, TilingSprite } from "pixi.js";
import { InterpolationBuffer } from "interpolation-buffer";
import { HathoraClient, UpdateArgs } from "../.hathora/client";
import { Orientation, Ship, CannonBall, PlayerState } from "../../api/types";

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 900;

type EntityId = string | number;
const client = new HathoraClient();
const entities: Map<EntityId, Sprite> = new Map();
const waterTexture = Texture.from("water.png");
const shipTextures = [...Array(4)].map((_, i) => Texture.from(`ship${i}.png`));
const cannonBallTexure = Texture.from("cannonBall.png");

setupApp().then((view) => {
  document.body.appendChild(view);
});

async function setupApp() {
  const app = new Application({ width: MAP_WIDTH, height: MAP_HEIGHT });
  const background = new TilingSprite(waterTexture, app.view.width, app.view.width);
  app.stage.addChild(background);

  if (sessionStorage.getItem("token") === null) {
    sessionStorage.setItem("token", await client.loginAnonymous());
  }
  const token = sessionStorage.getItem("token")!;
  const user = HathoraClient.getUserFromToken(token);
  let buffer: InterpolationBuffer<PlayerState> | undefined;
  const connection = await getClient(token, ({ state, updatedAt }) => {
    if (state.ships.find((ship) => ship.player === user.id) === undefined) {
      connection.joinGame({});
    }
    if (buffer === undefined) {
      buffer = new InterpolationBuffer<PlayerState>(state, 100, lerp);
    } else {
      buffer.enqueue(state, updatedAt);
    }
  });

  const keysDown: Set<string> = new Set();
  function handleKeyEvt(e: KeyboardEvent) {
    if (e.key === " " && e.type === "keydown") {
      connection.fireCannon({});
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.key)) {
      return;
    }
    if (e.type === "keydown") {
      if (keysDown.has(e.key)) {
        return;
      }
      keysDown.add(e.key);
    } else if (e.type === "keyup") {
      keysDown.delete(e.key);
    }
    const orientation = keysDown.has("ArrowLeft")
      ? Orientation.LEFT
      : keysDown.has("ArrowRight")
      ? Orientation.RIGHT
      : Orientation.FORWARD;
    connection.setOrientation({ orientation, accelerating: keysDown.has("ArrowUp") });
  }
  document.addEventListener("keydown", handleKeyEvt);
  document.addEventListener("keyup", handleKeyEvt);

  app.ticker.add(() => {
    if (buffer === undefined) {
      return;
    }
    const state = buffer.getInterpolatedState(Date.now());
    const updatedEntites: Set<EntityId> = new Set();
    function handleEntity(id: EntityId, x: number, y: number, angle: number, spriteGenerator: () => Sprite) {
      updatedEntites.add(id);
      if (!entities.has(id)) {
        const sprite = spriteGenerator();
        sprite.anchor.set(0.5);
        app.stage.addChild(sprite);
        entities.set(id, sprite);
      } else {
        const sprite = entities.get(id)!;
        sprite.rotation = angle - Math.PI / 2;
        sprite.x = x;
        sprite.y = y;
      }
    }
    state.ships.forEach(({ player, x, y, angle, hitCount }) => {
      handleEntity(player, x, y, angle, () => new AnimatedSprite(shipTextures));
      (entities.get(player)! as AnimatedSprite).gotoAndStop(hitCount);
    });
    state.cannonBalls.forEach(({ id, x, y }) => handleEntity(id, x, y, 0, () => new Sprite(cannonBallTexure)));
    for (const entityId of entities.keys()) {
      if (!updatedEntites.has(entityId)) {
        entities.get(entityId)!.destroy();
        entities.delete(entityId);
      }
    }
  });

  return app.view;
}

async function getClient(token: string, onStateChange: (args: UpdateArgs) => void) {
  if (location.pathname.length > 1) {
    return client.connect(token, location.pathname.split("/").pop()!, onStateChange, console.error);
  } else {
    const stateId = await client.create(token, {});
    history.pushState({}, "", `/${stateId}`);
    return client.connect(token, location.pathname.split("/").pop()!, onStateChange, console.error);
  }
}

function lerp(from: PlayerState, to: PlayerState, pctElapsed: number): PlayerState {
  return {
    ships: to.ships.map((toShip) => {
      const fromShip = from.ships.find((s) => s.player === toShip.player);
      return fromShip !== undefined ? lerpShip(fromShip, toShip, pctElapsed) : toShip;
    }),
    cannonBalls: to.cannonBalls.map((toCannonBall) => {
      const fromCannonBall = from.cannonBalls.find((c) => c.id === toCannonBall.id);
      return fromCannonBall !== undefined ? lerpCannonBall(fromCannonBall, toCannonBall, pctElapsed) : toCannonBall;
    }),
  };
}

function lerpShip(from: Ship, to: Ship, pctElapsed: number) {
  return {
    player: from.player,
    x: from.x + (to.x - from.x) * pctElapsed,
    y: from.y + (to.y - from.y) * pctElapsed,
    angle: from.angle + (to.angle - from.angle) * pctElapsed,
    hitCount: pctElapsed < 0.5 ? from.hitCount : to.hitCount,
  };
}

function lerpCannonBall(from: CannonBall, to: CannonBall, pctElapsed: number) {
  return {
    id: from.id,
    x: from.x + (to.x - from.x) * pctElapsed,
    y: from.y + (to.y - from.y) * pctElapsed,
  };
}
