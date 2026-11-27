/** UI texts (pt-BR). Kept in one place so translating later is easy. */
export const strings = {
  round: (n: number) => `Rodada ${n}`,
  zombiesLeft: (n: number) => `${n} zumbis`,
  roundCleared: (n: number) => `Rodada ${n} concluída!`,
  intermission: 'Intervalo',
  nextRoundIn: (time: string) => `Próxima rodada em ${time}`,
  skip: 'Pular',
  missionFailed: 'Missão falhada',
  timeUp: 'O tempo acabou',
  reachedRound: (n: number) => `Rodada alcançada: ${n}`,
  totalKills: (n: number) => `Zumbis mortos: ${n}`,
  // Becomes "Voltar ao lobby" once the lobby exists.
  playAgain: 'Jogar de novo',
}
