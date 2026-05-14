<?php

$config = array();

// DB
$config['db_host'] = "localhost";
$config['db_username'] = "tienda_user";
$config['db_password'] = 'HwXH9hat1vrgr$7*';
$config['db_name'] = "tienda";




$config['tienda_productos'] = [
            [
                'id' => '10004',
                'title' => 'Vet Life Natural Canine - Hepatic Canine',
                'description' => 'Alimento coadyuvante seco indicado para perros adultos con insuficiencia hepática crónica.',
                'price' => '17.00 MXN',
                'link' => 'https://tienda.cdev.mx/producto/ver/10004',
                'image_link' => 'https://www.farmina.com/fotoprodotti/l_18240_58_l_8915_00_farmina-vetlife-natural-canine-hepatic_direito.png',
                'brand' => 'Farmina Pet Foods',
                'availability' => 'in stock',
                'condition' => 'new'
            ],
            [
                'id' => '10003',
                'title' => 'N&D Quinoa Canine',
                'description' => 'Alimento completo y balanceado para perros adultos con piel sensible',
                'price' => '25.00 MXN',
                'link' => 'https://tienda.cdev.mx/producto/ver/10003',
                'image_link' => 'https://www.farmina.com/fotoprodotti/479_28_N_D%20Quinoa%20Canine%20Skin%20_%20Coat%20Peixe.png',
                'brand' => 'Farmina Pet Foods',
                'availability' => 'in stock',
                'condition' => 'new'
            ],
            [
                'id' => '10002',
                'title' => 'N&D Ocean canine',
                'description' => 'Alimento completo y balanceado para perros cachorros de razas pequeñas y para hembras en el tercio final de la gestación y lactancia.',
                'price' => '30.00 MXN',
                'link' => 'https://tienda.cdev.mx/producto/ver/10002',
                'image_link' => 'https://www.farmina.com/fotoprodotti/954_31_nd-ocean-canine-salmon-melon-puppy-mini-2.5kg@pack.png',
                'brand' => 'Farmina Pet Foods',
                'availability' => 'in stock',
                'condition' => 'new'
            ],
            [
                'id' => '10001',
                'title' => 'Vet Life Natural Canine Hypoallergenic',
                'description' => 'Alimento coadyuvante seco recomendado para auxiliar en la recuperación de perros con alergias o intolerancia a nutrientes.',
                'price' => '20.00 MXN',
                'link' => 'https://tienda.cdev.mx/producto/ver/10001',
                'image_link' => 'https://www.farmina.com/fotoprodotti/l_10051_25_l_4846_27_farmina-vetlife-natural-canine-hypoallergenic_direito.png',
                'brand' => 'Farmina Pet Foods',
                'availability' => 'in stock',
                'condition' => 'new'
            ],
            [
                'id' => '10000',
                'title' => 'N&D Prime Canine',
                'description' => 'Pollo y Granada - Alimento completo y balanceado para perros cachorros de razas pequeñas y para hembras en el tercio final de la gestación y lactancia.',
                'price' => '10.00 MXN',
                'link' => 'https://tienda.cdev.mx/producto/ver/10000',
                'image_link' => 'https://www.farmina.com/fotoprodotti/l_10082_42_l_4882_42_Prime_Canine_Frango_Puppy_Mini_Direito.png',
                'brand' => 'Farmina Pet Foods',
                'availability' => 'in stock',
                'condition' => 'new'
            ]
        ];


// DB Remote
$config['db_host_remote'] = "10.10.200.24";
$config['db_username_remote'] = "root";
$config['db_password_remote'] = "Todotv.2014";
$config['db_name_remote'] = "todotvnews";
$config['base_externa'] = false;
$config['api_host'] = "https://tienda.cdev.mx";
$config['authorization_key'] = 'RapipetsMUBzcG9kjkezdW1taXQuY2adasd9tLmJyOlNqaHRlbGhwVUdNNU9IaDRNWEV4V0hReU1VcHVjpkjipkjRWw1ZWxkcWNYSlZLelZDY21aQ234567PQ==-';

// APP
$config['site_name'] = "NeoShop";
$config['document_root'] = $_SERVER['DOCUMENT_ROOT'];
$config['url_path'] = '';
$config['domain'] = "https://" . $_SERVER['HTTP_HOST'] . $config['url_path'];
$config['cron_hp'] = 'dasf34f3qddfg23dfdsaf3g45';


// Files 
$config['files'] = '/public/files';

// Mailing
$config['smtp.host'] = "mail.cdev.mx";
$config['smtp.port'] = "465";
$config['smtp.user'] = "emanuel.flores@cdev.mx";
$config['smtp.pass'] = "E9mt7o19#";
$config['smtp.email'] = "emanuel.flores@cdev.mx";
$config['smtp.prueba'] = "emanuel.flores@cdev.mx";
$config['smtp.name'] = "Ventas";

$config['email.ventas'] = "Ventas <ventas@neoyorkinos.com.mx>";

// Maxmind
$config['maxmind_key'] = 'Uyoi2aZstoYtqqcV';

// MEMCACHED SERVER
$config['memcached_host'] = '127.0.0.1';
$config['memcached_port'] = '11211';

// WHATSAPP
//$config['token_whatsapp'] = 'EAAY2AZALJLTsBO4vD7jeo8l1Eqcjm3qYJSZBZCzKgZBTglEnHTf8fRhlQrThBFCnfjf6y7tBalUDFyIttr71ieE7PiXZCZA0IqqawwMBeY7c8UCiPYLgoIvuFTXBuAyShXf363bd5AshRjwuGfIom3yYqXZCalAeN4qOO7eNGDJZBEd6zZABdMkDZBnlzuzQOnJQZDZD';
//$config['phone_number_id'] = '678242138709903';
$config['whatsapp_token'] = 'TmUStG3LjBaeR-1913-bfd62bc';
//$config['whatsapp_telefono'] = '5215659130841';


// ENCRIPTACION
$config['secret_key'] = 'vNUdOZWU1eESXV6VXp6czV6T2J6Z1VhWHJXK2s';
$config['secret_iv'] = 'VhWHJXK2s5SXV6VXp6czV6T2RSKzVGLzJZWlh4WjQ2M1krNmJGbk9RTHQyUVNrQVlY';
$config['encrypt_method'] = 'AES-256-CBC';

//MERCADO PAGO
//$config['public_key_mp'] = 'APP_USR-963efc79-df4b-41ff-88f1-ff4d30c0735b';
//$config['secret_key_mp'] = 'APP_USR-3133830383633102-060618-6b695476f8fd865e9dd65960ea54601d-744408061';
$config['webhook_secret_mp2'] = '682ed5f888022cf6f92a6a1b9ba60fc6f18aad6d56b064ea1bca9d8460fef7d4';
$config['webhook_secret_mp'] = '682ed5f888022cf6f92a6a1b9ba60fc6f18aad6d56b064ea1bca9d8460fef7d4';

//OPENAI 
$config['openai_api_key'] = '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';

return $config;