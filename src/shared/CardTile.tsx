import _ from "lodash";
import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  CARD_RARITIES,
  CARD_TILE_FLAT,
  COLORS_ALL,
  FACE_SPLIT_FULL,
  FACE_ADVENTURE_MAIN
} from "./constants";
import Deck from "./deck";
import {
  get_wc_missing as getWildcardsMissing,
  getCardArtCrop,
  openScryfallCard
} from "./util";
import { addCardHover } from "./card-hover";

export interface CardTileProps {
  card: any;
  deck: Deck | null;
  dfcCard: any;
  indent: string;
  isHighlighted: boolean;
  isSideboard: boolean;
  landOdds: any;
  quantity: { quantity: string; odds: number } | number | string; // TODO clean this up?
  showWildcards: boolean;
  style: number;
}

function isNumber(n: number | string): boolean {
  return !isNaN(parseFloat(n as string)) && isFinite(parseFloat(n as string));
}

function frameClassName(card: any): string {
  const frame = card ? card.frame.concat().sort() : [];
  if (_.isEqual(frame, [])) return "tile_c";
  if (_.isEqual(frame, [1])) return "tile_w";
  if (_.isEqual(frame, [2])) return "tile_u";
  if (_.isEqual(frame, [3])) return "tile_b";
  if (_.isEqual(frame, [4])) return "tile_r";
  if (_.isEqual(frame, [5])) return "tile_g";
  if (_.isEqual(frame, [1, 2])) return "tile_uw";
  if (_.isEqual(frame, [1, 3])) return "tile_wb";
  if (_.isEqual(frame, [1, 4])) return "tile_wr";
  if (_.isEqual(frame, [1, 5])) return "tile_gw";
  if (_.isEqual(frame, [2, 3])) return "tile_ub";
  if (_.isEqual(frame, [2, 4])) return "tile_ur";
  if (_.isEqual(frame, [2, 5])) return "tile_ug";
  if (_.isEqual(frame, [3, 4])) return "tile_br";
  if (_.isEqual(frame, [3, 5])) return "tile_bg";
  if (_.isEqual(frame, [4, 5])) return "tile_rg";
  if (frame.length > 2) return "tile_multi";
  return "";
}

function rankingClassName(ranking: number | string): string {
  switch (ranking) {
    case "A+":
    case "A":
      return "blue";

    case "A-":
    case "B+":
    case "B":
      return "green";

    case "C-":
    case "D+":
    case "D":
      return "orange";

    case "D-":
    case "F":
      return "red";

    default:
      return "white";
  }
}

function getArenaQuantityDisplay(quantity: any): [number, number, JSX.Element] {
  let ww, ll, quantityElement;
  if (typeof quantity === "object") {
    ww = 64;
    ll = 48;
    const rankClass = rankingClassName(quantity.quantity);
    quantityElement = (
      <div className={"card_tile_odds " + rankClass}>
        <span>{quantity.quantity}</span>
      </div>
    );
  } else if (!isNumber(quantity)) {
    ww = 64;
    ll = 48;
    const rankClass = rankingClassName(quantity);
    quantityElement = (
      <div className={"card_tile_odds " + rankClass}>
        <span>{quantity}</span>
      </div>
    );
  } else if (quantity === 9999) {
    ww = 32;
    ll = 17;
    quantityElement = (
      <div
        className="card_tile_quantity"
        style={{
          color: "rgba(255, 255, 255, 0)",
          minWidth: "0px",
          width: "0px"
        }}
      >
        <span>1</span>
      </div>
    );
  } else {
    ww = 64;
    ll = 49;
    quantityElement = (
      <div className="card_tile_quantity">
        <span>{quantity}</span>
      </div>
    );
  }
  return [ww, ll, quantityElement];
}

function CostSymbols(props: { card: any; dfcCard: any }): JSX.Element {
  const { card, dfcCard } = props;
  const costSymbols: JSX.Element[] = [];
  let prevc = true;
  const hasSplitCost = card.dfc === FACE_SPLIT_FULL;
  if (card.cost) {
    card.cost.forEach((cost: string, index: number) => {
      if (hasSplitCost) {
        if (/^(x|\d)+$/.test(cost) && prevc === false) {
          costSymbols.push(<span key={card.id + "_cost_separator"}>//</span>);
        }
        prevc = /^\d+$/.test(cost);
      }
      costSymbols.push(
        <div
          key={card.id + "_" + index}
          className={"mana_s16 flex_end mana_" + cost}
        />
      );
    });
  }
  if (card.dfc === FACE_ADVENTURE_MAIN && dfcCard && dfcCard.cost) {
    costSymbols.push(<span key={dfcCard.id + "_cost_separator"}>//</span>);
    dfcCard.cost.forEach((cost: string, index: number) => {
      costSymbols.push(
        <div
          key={dfcCard.id + "_" + index}
          className={"mana_s16 flex_end mana_" + cost}
        />
      );
    });
  }
  return <>{costSymbols}</>;
}

function ArenaWildcardsNeeded(props: {
  card: any;
  deck: Deck;
  isSideboard: boolean;
  ww: number;
}): JSX.Element {
  const { card, deck, isSideboard, ww } = props;
  if (card.type.indexOf("Basic Land") === -1) {
    const missing = getWildcardsMissing(deck, card.id, isSideboard);
    if (missing > 0) {
      const xoff = CARD_RARITIES.indexOf(card.rarity) * -24;
      const yoff = missing * -24;
      return (
        <div
          className="not_owned_sprite"
          title={missing + " missing"}
          style={{
            backgroundPosition: `${xoff}px ${yoff}px`,
            left: `calc(0px - 100% + ${ww - 14}px)`
          }}
        />
      );
    }
  }
  return <></>;
}

function ArenaCardTile(props: CardTileProps): JSX.Element {
  const {
    card,
    deck,
    dfcCard,
    indent,
    isHighlighted,
    isSideboard,
    landOdds,
    quantity,
    showWildcards
  } = props;

  const [isMouseHovering, setMouseHovering] = useState(false);
  const handleMouseEnter = useCallback((): void => setMouseHovering(true), []);
  const handleMouseLeave = useCallback((): void => setMouseHovering(false), []);
  const handleMouseClick = useCallback((): void => {
    let _card = card;
    if (card.dfc === FACE_SPLIT_FULL) {
      _card = dfcCard || card;
    }
    openScryfallCard(_card);
  }, [card]);

  const containerEl = useRef(null);
  useEffect(() => {
    const containerDiv = containerEl.current;
    if (containerDiv) {
      addCardHover(containerDiv, card, landOdds);
    }
  }, [card, landOdds]);

  const [ww, ll, quantityElement] = getArenaQuantityDisplay(props);

  return (
    <div
      className="card_tile_container click-on"
      data-grp-id={card.id}
      data-id={indent}
      data-quantity={quantity}
      ref={containerEl}
      style={{
        backgroundColor: isHighlighted
          ? "rgba(250, 229, 210, 0.66)"
          : "rgba(0, 0, 0, 0.75)"
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleMouseClick}
    >
      {quantityElement}
      <div
        className={"card_tile " + (card.frame ? frameClassName(card) : "")}
        style={{
          minWidth: `calc(100% - ${ww}px)`,
          marginTop: isMouseHovering ? 0 : "3px"
        }}
      >
        <div className="flex_item">
          <div className="card_tile_name">{card.name || "Unknown"}</div>
        </div>
        <div className="flex_item" style={{ lineHeight: "26px" }}>
          <CostSymbols card={card} dfcCard={dfcCard} />
        </div>
      </div>
      <div
        className="card_tile_glow"
        style={{
          minWidth: `calc(100% - ${ww}px)`,
          left: `calc(0px - 100% + ${ll}px)`
        }}
      />
      {showWildcards && deck && (
        <ArenaWildcardsNeeded
          card={card}
          deck={deck}
          isSideboard={isSideboard}
          ww={ww}
        />
      )}
    </div>
  );
}

function FlatQuantityDisplay(props: { quantity: any }): JSX.Element {
  const { quantity } = props;
  if (typeof quantity === "object") {
    // Mixed quantity (odds and quantity)
    return (
      <div className="card_tile_odds_flat">
        <div className="card_tile_odds_flat_half">{quantity.quantity}</div>
        <div className="card_tile_odds_flat_half_dark">{quantity.odds}</div>
      </div>
    );
  } else if (!isNumber(quantity)) {
    // Text quantity
    const rankClass = rankingClassName(quantity);
    return <div className={"card_tile_odds_flat " + rankClass}>{quantity}</div>;
  } else if (quantity === 9999) {
    // Undefined Quantity
    return <div className="card_tile_quantity_flat">1</div>;
  } else {
    // Normal Quantity
    return <div className="card_tile_quantity_flat">{quantity}</div>;
  }
}

function FlatWildcardsNeeded(props: {
  card: any;
  deck: Deck;
  isSideboard: boolean;
}): JSX.Element {
  const { card, deck, isSideboard } = props;
  if (card.type.indexOf("Basic Land") === -1) {
    const missing = getWildcardsMissing(deck, card.id, isSideboard);
    if (missing > 0) {
      const xoff = CARD_RARITIES.indexOf(card.rarity) * -24;
      const yoff = missing * -24;
      return (
        <div
          className="not_owned_sprite_flat"
          title={missing + " missing"}
          style={{
            backgroundPosition: `${xoff}px ${yoff}px`
          }}
        />
      );
    }
  }
  return <></>;
}

function FlatCardTile(props: CardTileProps): JSX.Element {
  const {
    card,
    deck,
    dfcCard,
    indent,
    isHighlighted,
    isSideboard,
    landOdds,
    quantity,
    showWildcards
  } = props;
  const [isMouseHovering, setMouseHovering] = useState(false);
  const handleMouseEnter = useCallback((): void => setMouseHovering(true), []);
  const handleMouseLeave = useCallback((): void => setMouseHovering(false), []);
  const handleMouseClick = useCallback((): void => {
    let _card = card;
    if (card.dfc === FACE_SPLIT_FULL) {
      _card = dfcCard || card;
    }
    openScryfallCard(_card);
  }, [card]);

  const containerEl = useRef(null);
  useEffect(() => {
    const containerDiv = containerEl.current;
    if (containerDiv) {
      addCardHover(containerDiv, card, landOdds);
    }
  }, [card, landOdds]);

  const cardTileStyle = { backgroundImage: "", borderImage: "" };
  try {
    if (card.type == "Special") {
      cardTileStyle.backgroundImage = `url(${card.images["art_crop"]})`;
    } else {
      cardTileStyle.backgroundImage = `url(${getCardArtCrop(card)})`;
    }
  } catch (e) {
    console.log(e);
  }

  let colorA = "c";
  let colorB = "c";
  if (card.frame) {
    if (card.frame.length == 1) {
      colorA = COLORS_ALL[card.frame[0] - 1];
      colorB = COLORS_ALL[card.frame[0] - 1];
    } else if (card.frame.length == 2) {
      colorA = COLORS_ALL[card.frame[0] - 1];
      colorB = COLORS_ALL[card.frame[1] - 1];
    } else if (card.frame.length > 2) {
      colorA = "m";
      colorB = "m";
    }
  }
  cardTileStyle.borderImage = `linear-gradient(to bottom, var(--color-${colorA}) 30%, var(--color-${colorB}) 70%) 1 100%`;

  const tileStyle = { backgroundColor: "rgba(0, 0, 0, 0.75)" };
  if (isHighlighted) {
    tileStyle.backgroundColor = "rgba(250, 229, 210, 0.66)";
  } else if (isMouseHovering) {
    tileStyle.backgroundColor = "rgba(65, 50, 40, 0.75)";
  }

  return (
    <div
      className="card_tile_container_flat click-on"
      data-grp-id={card.id}
      data-id={indent}
      data-quantity={quantity}
      ref={containerEl}
      style={tileStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleMouseClick}
    >
      <FlatQuantityDisplay quantity={quantity} />
      <div className="card_tile_crop_flat" style={cardTileStyle} />
      <div className="card_tile_name_flat">{card.name || "Unknown"}</div>
      <div className="cart_tile_mana_flat">
        <CostSymbols card={card} dfcCard={dfcCard} />
      </div>
      {showWildcards && deck && (
        <FlatWildcardsNeeded
          card={card}
          deck={deck}
          isSideboard={isSideboard}
        />
      )}
    </div>
  );
}

export default function CardTile(props: CardTileProps): JSX.Element {
  const { card, quantity } = props;
  // This is hackish.. the way we insert our custom elements in the
  // array of cards is wrong in the first place :()
  const haxxorProps = { ...props };
  if (card.id && typeof card.id === "object" && card.id.name) {
    haxxorProps.card = card.id;
  }
  if (!card || quantity === 0) {
    return <></>;
  }
  if (haxxorProps.style === CARD_TILE_FLAT) {
    return FlatCardTile(haxxorProps);
  }
  return ArenaCardTile(haxxorProps);
}
