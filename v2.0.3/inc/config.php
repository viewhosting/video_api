<?php

$config = array();

$config['version'] = "2.0.2";
$config['copyright'] = "Copyright © " . date('Y') . " UNIK Marketing Solutions, creado por Emanuel Flores";


// DB
$config['db_host'] = "localhost";
$config['db_username'] = "root";
$config['db_password'] = '96Qm7fn_';
$config['db_name'] = "_api_";

// DB Remote
$config['db_host_remote'] = "10.10.200.24";
$config['db_username_remote'] = "root";
$config['db_password_remote'] = "Todotv.2014";
$config['db_name_remote'] = "todotvnews";
$config['base_externa'] = false;
$config['authorization_key'] = 'RapipetsMUBzcG9kjkezdW1taXQuY2adasd9tLmJyOlNqaHRlbGhwVUdNNU9IaDRNWEV4V0hReU1VcHVjpkjipkjRWw1ZWxkcWNYSlZLelZDY21aQ234567PQ==-';

// APP
$config['site_name'] = "VideoAPI";
$config['document_root'] = $_SERVER['DOCUMENT_ROOT'];
$config['url_path'] = '/video_';
$config['domain'] = "https://" . $_SERVER['HTTP_HOST'] . $config['url_path'];
$config['cron_hp'] = 'dasf34f3qddfg23dfdsaf3g45';

// Files 
$config['files'] = '/public/files';
// Maxmind
$config['maxmind_key'] = 'Uyoi2aZstoYtqqcV';

// MEMCACHED SERVER
$config['memcached_host'] = '127.0.0.1';
$config['memcached_port'] = '11211';


// ENCRIPTACION
$config['secret_key'] = 'fTjWnZr4u7x!A%D*G-KaPdSgVkYp2s5v8y/B?E(H+MbQeThWmZq4t6w9z$C&F)J@';
$config['secret_iv'] = 'Xp2s5v8y/B?E(H+M';
$config['encrypt_method'] = 'AES-256-CBC';


return $config;