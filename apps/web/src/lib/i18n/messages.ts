/**
 * Typed UI catalogs. Each locale file `satisfies Messages`, so a missing
 * Polish key is a type error.
 */
export interface Messages {
  economy: {
    /**
     * Per-player average freeze equipment. `{amount}` is the rounded dollar
     * figure (`$5,020`), already formatted. English: `avg $5,020`.
     */
    averageEquipment: string;
  };
}
