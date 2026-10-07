export interface PortfolioPosition {
  readonly instrumentId: number;
  readonly ticker: string | null;
  readonly name: string | null;
  readonly quantity: number;
  readonly marketPrice: string;
  readonly marketValue: string;
  readonly costBasis: string | null;
  readonly returnPercentage: string | null;
  readonly dailyPriceChangePercentage: string | null;
  readonly quoteDate: string;
}
