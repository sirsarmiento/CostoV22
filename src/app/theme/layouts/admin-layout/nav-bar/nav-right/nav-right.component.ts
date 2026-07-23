// angular import
import { Component, output, inject, input } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';

// third party

// icon
import { IconService } from '@ant-design/icons-angular';
import {
  BellOutline,
  SettingOutline,
  GiftOutline,
  MessageOutline,
  PhoneOutline,
  CheckCircleOutline,
  LogoutOutline,
  EditOutline,
  UserOutline,
  ProfileOutline,
  WalletOutline,
  QuestionCircleOutline,
  LockOutline,
  CommentOutline,
  UnorderedListOutline,
  ArrowRightOutline,
  GithubOutline
} from '@ant-design/icons-angular/icons';

@Component({
  selector: 'app-nav-right',
  imports: [SharedModule, RouterModule],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss']
})
export class NavRightComponent {
  firstName: string | undefined;
  lastName: string | undefined;
  position: string | undefined;
  private iconService = inject(IconService);

  // public props
  styleSelectorToggle = input<boolean>();
  readonly Customize = output();
  windowWidth: number;
  screenFull: boolean = true;
  direction: string = 'ltr';

  // constructor
  constructor(private router: Router) {
    this.windowWidth = window.innerWidth;
    this.iconService.addIcon(
      ...[
        CheckCircleOutline,
        GiftOutline,
        MessageOutline,
        SettingOutline,
        PhoneOutline,
        LogoutOutline,
        EditOutline,
        UserOutline,
        EditOutline,
        ProfileOutline,
        QuestionCircleOutline,
        LockOutline,
        CommentOutline,
        UnorderedListOutline,
        ArrowRightOutline,
        BellOutline,
        GithubOutline,
        WalletOutline
      ]
    );
  }

  ngOnInit(): void {
    const userInfo = this.getUserInfoFromLocalStorage();
    console.log('userInfo', userInfo);
    if (userInfo) {
      this.firstName = userInfo.firstName;
      this.lastName = userInfo.lastName;
      this.position = userInfo.position;
    }
  }

  getUserInfoFromLocalStorage(): { firstName: string, lastName: string, position: string } | null {
    try {
      const cusrData = localStorage.getItem('cusr');

      if (!cusrData) {
        console.warn('No se encontró la clave "cusr" en Local Storage');
        return null;
      }

      // Parsear el JSON
      const parsedData = JSON.parse(cusrData);

      console.log('parsedData', parsedData);

      // Verificar que la estructura sea la esperada
      if (parsedData && parsedData.user && parsedData.user.firstName && parsedData.user.lastName) {
        return {
          firstName: parsedData.user.firstName,
          lastName: parsedData.user.lastName,
          position: parsedData.user.position?.label || 'Sin posición' // Usa optional chaining y valor por defecto
        };
      } else {
        console.warn('Estructura del objeto "cusr" no es la esperada');
        return null;
      }
    } catch (error) {
      console.error('Error al obtener datos del Local Storage:', error);
      return null;
    }
  }
  /**
   * Logout
   */
  onLogout(e: Event) {
    e.preventDefault();
    localStorage.removeItem('isLoggedin');

    if (!localStorage.getItem('isLoggedin')) {
      this.router.navigate(['/login']);
    }
  }

  profile = [
    {
      icon: 'edit',
      title: 'Edit Profile'
    },
    {
      icon: 'user',
      title: 'View Profile'
    },
    {
      icon: 'profile',
      title: 'Social Profile'
    },
    {
      icon: 'wallet',
      title: 'Billing'
    }
    // {
    //   icon: 'logout',
    //   title: 'Logout'
    // }
  ];

  setting = [
    {
      icon: 'question-circle',
      title: 'Support'
    },
    {
      icon: 'user',
      title: 'Account Settings'
    },
    {
      icon: 'lock',
      title: 'Privacy Center'
    },
    {
      icon: 'comment',
      title: 'Feedback'
    },
    {
      icon: 'unordered-list',
      title: 'History'
    }
  ];
}
