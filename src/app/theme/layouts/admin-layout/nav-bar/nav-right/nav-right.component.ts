import { Component, OnInit, output, inject, input } from '@angular/core';
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

import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-nav-right',
  imports: [SharedModule, RouterModule],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss']
})
export class NavRightComponent implements OnInit {
  firstName: string | undefined;
  lastName: string | undefined;
  position: string | undefined;
  private iconService = inject(IconService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // public props
  styleSelectorToggle = input<boolean>();
  readonly Customize = output();
  windowWidth: number;
  screenFull: boolean = true;
  direction: string = 'ltr';

  // constructor
  constructor() {
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
    if (userInfo) {
      this.firstName = userInfo.firstName;
      this.lastName = userInfo.lastName;
      this.position = userInfo.position;
    }
  }

  get userInitials(): string {
    const fn = (this.firstName || '').trim().charAt(0).toUpperCase();
    const ln = (this.lastName || '').trim().charAt(0).toUpperCase();
    const init = (fn + ln).trim();
    return init || 'U';
  }

  get userFullName(): string {
    const full = `${this.firstName || ''} ${this.lastName || ''}`.trim();
    return full || 'Usuario';
  }

  getUserInfoFromLocalStorage(): { firstName: string, lastName: string, position: string } | null {
    try {
      const cusrData = localStorage.getItem('cusr');
      if (cusrData) {
        const parsedData = JSON.parse(cusrData);
        if (parsedData && parsedData.user) {
          return {
            firstName: parsedData.user.firstName || '',
            lastName: parsedData.user.lastName || '',
            position: parsedData.user.position?.label || parsedData.user.position?.Descripcion || 'Analista'
          };
        }
      }

      const user = this.authService.currentUser;
      if (user) {
        return {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          position: user.position?.label || 'Analista'
        };
      }

      return null;
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
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
      icon: 'lock',
      title: 'Cambiar Contraseña'
    }
  ];

  /* 
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
  */
}
