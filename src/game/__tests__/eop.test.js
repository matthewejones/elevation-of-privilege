import { Client } from 'boardgame.io/client';
import { DEFAULT_START_SUIT, INVALID_CARDS, STARTING_CARD_MAP } from '../../utils/constants';
import { ElevationOfPrivilege } from '../eop';
import { Local } from 'boardgame.io/multiplayer'

describe('game', () => {
  const spec = {
    game: ElevationOfPrivilege,
    numPlayers: 3,
    multiplayer: Local(),
  }
  const players = {
    "0": Client({ ...spec, playerID: "0", }),
    "1": Client({ ...spec, playerID: "1", }),
    "2": Client({ ...spec, playerID: "2", }),
  }

  let createdThreat = "";
  const STARTING_CARD = STARTING_CARD_MAP[DEFAULT_START_SUIT];

  Object.keys(players).forEach(k => {
    players[k].start();
  });

  const startingPlayer = players['0'].getState().ctx.currentPlayer;

  it('should shuffle cards correctly', () => {
    let all = [];
    Object.keys(players).forEach(k => {
      all = all.concat(players[k].getState().G.players[k]);
    });

    let set = new Set(all);

    // expect unique cards
    expect(all.length).toBe(set.size);

    // expect that starting card should be present
    expect(all).toContain(STARTING_CARD);

    // expect that invalid cards shouldn't be present
    expect(all).toEqual(
      expect.not.arrayContaining(INVALID_CARDS),
    );
  });

  it('shouldn\'t start in a stage/phase', () => {
    expect(players['0'].getState().ctx.activePlayers).toBeFalsy();
    expect(players['0'].getState().ctx.phase).toBeFalsy();
  });

  it('should start with scores set to zero', () => {
    expect(players["0"].getState().G.scores).toStrictEqual([0,0,0]);
  });

  it('have correct order in ctx', () => {
    const state = players['0'].getState();
    expect(state.ctx.playOrder).toStrictEqual(['0', '1', '2']);
  });

  it('should move to the threats stage when the first player makes a move', () => {
    const starting = players["0"].getState().ctx.currentPlayer;
    players[starting].moves.draw(STARTING_CARD);

    const state = players["0"].getState();
    expect(state.G.dealt).toContain(STARTING_CARD);
    expect(state.G.dealtBy).toBe(starting);
    expect(state.G.suit).toBe(STARTING_CARD.substr(0, 1));
    expect(players['0'].getState().ctx.activePlayers).toStrictEqual({"0": "threats", "1": "threats", "2": "threats"})
  });

  it('the played card should not be present in the deck', () => {
    const lastPlayer = players["0"].getState().G.dealtBy;
    const cards = players[lastPlayer].getState().G.players[lastPlayer];
    expect(cards.includes(STARTING_CARD)).toBeFalsy();
  });

  it('player should not be able to draw again', () => {
    const lastPlayer = players["0"].getState().G.dealtBy;
    const cards = players[lastPlayer].getState().G.players[lastPlayer];
    const card = cards[Math.floor(Math.random()*cards.length)];

    players[lastPlayer].moves.draw(card);

    const state = players["0"].getState();

    expect(state.G.dealt.includes(card)).toBeFalsy();
  });

  it('anyone should be able to select diagrams in a threats stage', () => {
    Object.keys(players).forEach(k => {
      players[k].moves.selectDiagram(k);
      const state = players["0"].getState();
      expect(state.G.selectedDiagram).toBe(k);
    });
  });

  it('anyone should be able to select components in a threats stage', () => {
    Object.keys(players).forEach(k => {
      players[k].moves.selectComponent(k);
      const state = players["0"].getState();
      expect(state.G.selectedComponent).toBe(k);
    });
  });

  it('anyone should be able to select threats in a threats stage', () => {
    Object.keys(players).forEach(k => {
      players[k].moves.selectThreat(k);
      const state = players["0"].getState();
      expect(state.G.selectedThreat).toBe(k);
    });
  });

  it('anyone should be able to toggle the threat add modal in a threats stage', () => {
    Object.keys(players).forEach(k => {
      players[k].moves.toggleModal();
      let state = players["0"].getState();
      expect(state.G.threat.modal).toBeTruthy();
      expect(state.G.threat.owner).toBe(k);

      // only the owner should be able to toggle the modal again
      players[k].moves.toggleModal();
      state = players["0"].getState();
      expect(state.G.threat.modal).toBeFalsy();
    });
  });

  it('the players who pass in the threats stage should not be able to toggle the modal', () => {
    players["0"].moves.pass();
    players["0"].moves.pass();
    players["0"].moves.toggleModal();
    let state = players["0"].getState();
    expect(state.G.threat.modal).toBeFalsy();
  });

  it('the players who have passed should not be able to select a diagram', () => {
    players["0"].moves.selectDiagram("foo");
    let state = players["0"].getState();
    expect(state.G.selectedDiagram).not.toBe("foo");
  });

  it('the players who have passed should not be able to select a component', () => {
    players["0"].moves.selectComponent("foo");
    let state = players["0"].getState();
    expect(state.G.selectedComponent).not.toBe("foo");
  });

  it('the players who have passed should not be able to select a threat', () => {
    players["0"].moves.selectThreat("foo");
    let state = players["0"].getState();
    expect(state.G.selectedThreat).not.toBe("foo");
  });

  it('the players who have not passed should be able to add a threat', () => {
    players["1"].moves.toggleModal();
    let state = players["0"].getState();
    let diagram = state.G.selectedDiagram;
    let component = state.G.selectedComponent;
    createdThreat = state.G.threat.id;

    players["1"].moves.updateThreat("title", "foo");
    players["1"].moves.updateThreat("description", "bar");
    players["1"].moves.updateThreat("mitigation", "baz");
    players["1"].moves.addOrUpdateThreat();

    state = players["0"].getState();

    const t = state.G.identifiedThreats[diagram][component][createdThreat];
    expect(t.id).toBe(createdThreat);
    expect(t.owner).toBe("1");
    expect(t.title).toBe("foo");
    expect(t.description).toBe("bar");
    expect(t.mitigation).toBe("baz");
  });

  it('the players who have not passed and are owners should be able to toggle modal update', () => {
    players["1"].moves.toggleModalUpdate({
      owner: "1",
      title: "foo",
      description: "bar",
      mitigation: "baz",
    });
    let state = players["0"].getState();
    expect(state.G.threat.new).toBeFalsy();
    players["1"].moves.toggleModal();
  });

  it('the threat owners should be able to delete threats', () => {
    players["1"].moves.deleteThreat({
      owner: "1",
      id: createdThreat,
    });

    let state = players["0"].getState();
    let diagram = state.G.selectedDiagram;
    let component = state.G.selectedComponent;
    expect(state.G.identifiedThreats[diagram][component]).toStrictEqual({});
  });

  it('should move on when all players have passed', () => {
    players['1'].moves.pass();
    players['2'].moves.pass();

    expect(players['0'].getState().ctx.activePlayers).toBeFalsy();
  })

  it('should respect the play order', () => {
    const state = players['0'].getState()
    const nextPlayer = (parseInt(startingPlayer) + 1) % state.ctx.numPlayers;
    expect(state.ctx.currentPlayer).toBe(nextPlayer.toString())
  });
});
