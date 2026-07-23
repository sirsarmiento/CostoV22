export class Subfamily {
    id?: number;
    codigo!: string;
    nombre!: string;
}

export class Family {
    id?: number;
    codigo!: string;
    nombre!: string;
    subFamilias?: Subfamily[];
}
