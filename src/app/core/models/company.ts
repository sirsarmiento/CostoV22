import { SelectOption } from './select-option';


export class Company {
    id!: string;
    name!: string;
    status!: SelectOption;
    logo!: string;

    public static map(company: Company):Company{
        const newInstace = new Company();
        newInstace.id = company.id;
        newInstace.name = company.name
        newInstace.status = company.status;
        newInstace.logo = company.logo;
        return newInstace
    }

    public static mapForPost(company: Company){
        let companyMap:any = {};
        if (company.id) {
            Object.assign(companyMap, {id: company.id}) 
        }
        Object.assign(companyMap, { Nombre: company.name });
        Object.assign(companyMap, { Descripcion: company.name});
        Object.assign(companyMap, { idStatus: parseInt(company.status.value) });
        return companyMap;
    }

    public static mapFromObject(companyObj: any) {
        if (!companyObj)
            return;
        let company = new Company();
        company.id = companyObj.id;
        company.name = companyObj.nombre;

        if (companyObj.estatus)
        company.status = new SelectOption(companyObj.estatus.id, companyObj.estatus.Descripcion);
        return company;
    }

}
