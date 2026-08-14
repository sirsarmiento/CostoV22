/**
 * PaginationResponse model
 */
export class PaginationResponse {

  public count!: number;

  public nextPage: number;
  public previousPage: number;
  public totalPage!: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public data!: Array<any>;

  constructor(
    public page: number,
    public perPage: number,
  ) {
    this.nextPage = page + 1;
    this.previousPage = page - 1;
  }

  /**
   * Set the pagination count response
   * @param count the count value
   */
  public setCount(count: number) {
    this.count = count;
    if (this.count && this.perPage) {
      this.totalPage = Math.ceil(this.count / this.perPage);
    }
  }
}
