# dashboard/urls.py

from django.urls import path
from . import views


urlpatterns = [
    # Authentication
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # Password Reset Flow
    path('password-reset/', views.password_reset_request_view, name='password_reset_request'),
    # Note: Using <int:user_id> for security question step to directly pass user PK.
    # A token-based system is more secure for password resets.
    path('password-reset/security-question/<int:user_id>/', views.password_reset_security_question_view, name='password_reset_security_question'),
    path('password-reset/set-new/<int:user_id>/<str:token>/', views.password_reset_set_new_view, name='password_reset_set_new'),


    # Dashboard and its sections
    path('', views.dashboard, name='dashboard'),
    path('settings/', views.panel_settings, name='settings'),
    path('user/', views.user_settings, name='user'),
    path('routes/', views.routes, name='routes'),

    # Panel Settings Form Handlers
    path('settings/save-captcha/', views.save_captcha_settings_view, name='save_captcha_settings'),
    path('settings/save-control/', views.save_control_settings_view, name='save_control_settings'),

    # User Settings Form Handlers
    path('user/update-profile/', views.update_profile_settings_view, name='update_profile_settings'),
    path('user/update-password/', views.update_password_settings_view, name='update_password_settings'),
    path('user/update-security-question/', views.update_security_question_view, name='update_security_question'),
    path('user/lockdown-account/', views.lockdown_account_view, name='lockdown_account'),
]