import { Company } from "./company";
import { MenuItem } from "./menu.model";
import { SelectOption } from "./select-option";



export class userObservable {
    id!: number;
    firstName!: string;
    secondName!: string;
    lastName!: string;
    secondLastName!: string;
    email!: string;
    documentType!: string;
    documentNumber!: string;
    birthDate!: string;
    sex!: string;
    address!: string;
    idestructura!: number;
    position!: SelectOption;
    country!: SelectOption;
    state!: SelectOption;
    city!: SelectOption;
    roles?: any;
}

export class User {

    id!: number;
    username!: string;
    token?: string;
    roles?: any[];
    firstName!: string;
    secondName!: string;
    lastName!: string;
    secondLastName!: string
    email!: string;
    dependenceId!: string
    position!: SelectOption;

    positionId!: string;
    phones!: any[];
    birthDate!: any;
    documentType!: string;
    documentNumber!: string;
    status!: SelectOption;
    avatar!: string;
    createAt!: Date;
    updateAt!: Date;
    instrumentsPending!: Array<any>;
    optionsMenu!: Array<MenuItem>;
    sex!: string;
    address!: string;
    country!: SelectOption;
    state!: SelectOption;
    city!: SelectOption;
    socialNetwork!: Array<any>;
    answered!: boolean;
    hoursDedication!: string;
    nameInputHours!: string;
    freeDays!: any; // range of dates
    totalFreeDays!: any;
    company!: Company;
    password!: string;
    idestructura!: number;
    dependence!: string;

    get fullName() {
        return (this.firstName ? this.firstName : '') + ' ' + (this.lastName ? this.lastName : '');
    }

    get initialsName() {
        let initial = '';
        if (this.firstName) {
            initial = this.firstName.charAt(0);
        }
        if (this.lastName) {
            initial = initial + this.lastName.charAt(0);
        }
        return initial;
    }

    public static map(user: User): User {
        const newInstace = new User();
        newInstace.id = user.id;
        newInstace.username = user.username
        newInstace.firstName = user.firstName;
        newInstace.secondName = user.secondName;
        newInstace.lastName = user.lastName;
        newInstace.secondLastName = user.secondLastName;
        newInstace.email = user.email;
        newInstace.token = user.token;
        newInstace.position = user.position;
        newInstace.phones = user.phones;
        newInstace.birthDate = user.birthDate;
        newInstace.documentType = user.documentType;
        newInstace.documentNumber = user.documentNumber;
        newInstace.status = user.status;
        newInstace.avatar = user.avatar;
        newInstace.createAt = user.createAt;
        newInstace.updateAt = user.updateAt;
        newInstace.roles = user.roles;
        newInstace.instrumentsPending = user.instrumentsPending;
        newInstace.optionsMenu = user.optionsMenu;

        newInstace.sex = user.sex;
        newInstace.address = user.address;
        newInstace.country = user.country;
        newInstace.state = user.state;
        newInstace.city = user.city;
        newInstace.socialNetwork = user.socialNetwork;
        newInstace.company = user.company;

        newInstace.idestructura = user.idestructura;

        return newInstace
    }

    public static mapForPost(user: User) {
        let userMap: any = {};
        console.log(user);
        if (!user.id) {
            Object.assign(userMap, { username: user.email })
            console.log();
        }
        if (user.id) {
            Object.assign(userMap, { id: user.id })
        }

        Object.assign(userMap, { idStatus: 1 });
        Object.assign(userMap, { numeroDocumento: user.documentNumber });
        Object.assign(userMap, { tipoDocumentoIdentidad: user.documentType });
        Object.assign(userMap, { primerNombre: user.firstName });
        Object.assign(userMap, { segundoNombre: user.secondName });
        Object.assign(userMap, { primerApellido: user.lastName });
        Object.assign(userMap, { segundoApellido: user.secondLastName });
        Object.assign(userMap, { fechaNacimiento: user.birthDate }); // { fechaNacimiento: moment().year(user.birthDate.year).month(user.birthDate.month - 1).date(user.birthDate.day).format('YYYY-MM-DD') });
        Object.assign(userMap, { email: user.email });
        Object.assign(userMap, { idCargo: user.position });
        Object.assign(userMap, { direccion: user.address });
        Object.assign(userMap, { roles: this.getRolesUser(user.roles || []) }); // this.getRolesUser(user.roles) Por ahora estoy guardando un solo rol
        Object.assign(userMap, { sexo: user.sex });
        Object.assign(userMap, { direccion: user.address ? user.address : null });
        Object.assign(userMap, { pais: user.country });
        Object.assign(userMap, { estado: user.state });
        Object.assign(userMap, { ciudad: user.city });
        Object.assign(userMap, { idempresa: null });
        Object.assign(userMap, { idestructura: user.idestructura });
        return userMap;
    }

    static mapFromObject(userObj: any): User | undefined {
        if (!userObj)
            return;

        let userMap = new User();
        if (!userObj.id) {
            Object.assign(userMap, { username: userObj.email })
        }
        if (userObj.id) {
            Object.assign(userMap, { id: userObj.id })
        }
        userMap.id = userObj.id;
        userMap.username = userObj.username;
        userMap.firstName = userObj.primerNombre;
        userMap.lastName = userObj.primerApellido;
        userMap.secondName = userObj.segundoNombre;
        userMap.secondLastName = userObj.segundoApellido;
        userMap.email = userObj.email;
        if (userObj.cargo)
            userMap.position = new SelectOption(userObj.cargo.id, userObj.cargo.Descripcion);
        userMap.phones = userObj.telefonos;
        userMap.birthDate = userObj.fechaNacimiento;
        userMap.documentType = userObj.tipoDocumentoIdentidad;
        userMap.documentNumber = userObj.numeroDocumento;
        if (userObj.status)
            userMap.status = new SelectOption(userObj.status.id, userObj.status.Descripcion);
        userMap.createAt = userObj.createAt;
        userMap.updateAt = userObj.updateAt;
        userMap.sex = userObj.sexo;
        userMap.address = userObj.direccion;

        if (userObj.idestructura)
            userMap.idestructura = userObj.idestructura;

        if (userObj.pais)
            userMap.country = new SelectOption(userObj.pais?.id);
        if (userObj.estado)
            userMap.state = new SelectOption(userObj.estado?.id);
        if (userObj.ciudad)
            userMap.city = new SelectOption(userObj.ciudad?.id);
        return userMap;
    }

    public static mapForEditProfile(user: User) {
        let userMap: any = {};
        Object.assign(userMap, { id: user.id });
        Object.assign(userMap, { idStatus: parseInt(user.status.value) });

        Object.assign(userMap, { telefono: this.getPhonesUser(user.phones) });

        Object.assign(userMap, { direccion: user.address ? user.address : null });
        Object.assign(userMap, { pais: parseInt(user.country.value) });
        Object.assign(userMap, { estado: parseInt(user.state.value) });
        Object.assign(userMap, { ciudad: parseInt(user.city.value) });
        Object.assign(userMap, { redes: this.getNetworkUser(user.socialNetwork) });

        return userMap;
    }


    private static getPhonesUser(userPhones: any[]) {
        let phones;
        phones = userPhones.map((item: any) => {
            return { numero: item.numero };
        });
        return phones;
    }

    private static getRolesUser(userRoles: any[]) {
        let roles;
        roles = userRoles.map((item: string) => {
            return { rol: item };
        });
        return roles;
    }

    private static getNetworkUser(networks: any[]) {
        const arrayNetwork: any[] = [];

        networks.forEach((net: any) => {
            arrayNetwork.push({
                tipo: parseInt(net.idTipo),
                red: net.networkDir ? net.networkDir : ''

            });

        });

        return arrayNetwork;

    }

}
