
/**
 * SelectOption model
 */
export class SelectOption{

  public idOption!: number;
  public value!: string;
  public label!: string;
  public disabled!: boolean;
  public isSelected!: boolean;
  public link_google!: string;
  public morada!: string;
  public icon!: string;
  public color!: string;
  public status!: SelectOption;
  public flag!: boolean;
  public scales!: Array<any>; //escalas por cargos
  public weights!: Array<any>; // escalas por niveles
  public globalsPoints!: boolean;
  public haveScales!: boolean;
  public type: any;// Cardinal, Digital, Técnica
  public description!: string;

  /**
   * Used to display data in forms.
   * @param value Select option value
   * @param label Select option value
   */
  constructor(
    value?: string,
    label?: string,
    disabled?: boolean,
    color?: string
  ) {
    this.value = value ? String(value) : '';
    this.label = label || '';
    this.disabled = !!disabled;
    this.color = color || '';
  }

  /**
   * Getter: value
   */
  get id(): number {
    return Number(this.value);
  }

  /**
   * Getter: label
   */
  get name(): string {
    return this.label;
  }

  /**
   * Convert the object to an string
   * @return string the serialized value
   */
  toString(): string {
    return this.name;
  }
}
