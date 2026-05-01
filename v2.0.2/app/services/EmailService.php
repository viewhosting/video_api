<?php

namespace Services;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

class EmailService {
    private static $spoolPath = __DIR__ . '/../../recursos/spool';

    static public function send($to, $subject = "", $body = "", $modo = false) {  
    
    
  
    try{
      $mail = new PHPMailer(true);
      
      
      // $config['smtp.host'] = "mail.cdev.mx";
      // $config['smtp.port'] = "587";
      // $config['smtp.user'] = "altara@cdev.mx";
      // $config['smtp.pass'] = "d1t3@66Vw";
      // $config['smtp.email'] = "altara@cdev.mx";
      // $config['smtp.name'] = "altara@cdev.mx";
      // 
      // $config['email.prueba'] = "PRUEBA <emmanuelflores@viewhostingmexico.com>";
      try {
          //Server settings
          
          if($modo == false){
            $mail->SMTPDebug = SMTP::DEBUG_OFF;
          } else {
            $mail->SMTPDebug = SMTP::DEBUG_SERVER;
          }
          
          
                              //Enable verbose debug outputDEBUG_SERVER
          $mail->isSMTP();                                            //Send using SMTP
          $mail->Host       = \Services\Config::getInstance()->get('smtp.host');                     //Set the SMTP server to send through
          $mail->SMTPAuth   = true;                                   //Enable SMTP authentication
          $mail->Username   = \Services\Config::getInstance()->get('smtp.user');                     //SMTP username
          $mail->Password   = \Services\Config::getInstance()->get('smtp.pass');                               //SMTP password
          $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;            //Enable implicit TLS encryption
          $mail->Port       = 465;     
          $mail->CharSet = 'utf-8';                                //TCP port to connect to; use 587 if you have set `SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS`
      
          //Recipients
          $mail->setFrom(\Services\Config::getInstance()->get('smtp.email'), \Services\Config::getInstance()->get('smtp.name'));

          
          if($modo == false){
          $mail->addAddress($to['correo'], $to['nombre']);     //Add a recipient
        } else {
          $mail->addAddress(\Services\Config::getInstance()->get('smtp.prueba'), 'PRUEBAS');
        }



          //          $mail->addAddress(\Services\Config::getInstance()->get('smtp.email'), 'Altara Tesoreria');
          

          
          $mail->isHTML(true);                                  //Set email format to HTML
          $mail->Subject = $subject;
          $mail->Body    = $body;
          $mail->AltBody = strip_tags($body);
          
          if($modo){
            $mail->send();
            
            
            // $mbox = imap_open("{mail.cdev.mx:993/imap/ssl/novalidate-cert}", $mail->Username, $mail->Password, OP_HALFOPEN) or die("no se puede conectar: " . imap_last_error());
            // $mail_string = $mail->getSentMIMEMessage();
            // imap_append($mbox, '{mail.cdev.mx:993/imap/ssl/novalidate-cert}INBOX.Sent', $mail_string, "\\Seen");
            // imap_close($mbox);
            
            
            
            //save_mail($mail);
            
            //imap_append($mail, 'send', $mail->getSentMIMEMessage(), "\\Seen");


            
           
          } else {
            
           
            $mail->send();
          
            
          }
          
          // $mbox = imap_open("{mail.cdev.mx:993/imap/ssl/novalidate-cert}", $mail->Username, $mail->Password, OP_HALFOPEN) or die("no se puede conectar: " . imap_last_error());
          // $mail_string = $mail->getSentMIMEMessage();
          // imap_append($mbox, '{mail.cdev.mx:993/imap/ssl/novalidate-cert}INBOX.Sent', $mail_string, "\\Seen");
          // imap_close($mbox);
          
          
         // echo 'Message has been sent';
      } catch (Exception $e) {
          //echo "Message could not be sent. Mailer Error: {$mail->ErrorInfo}";
      }
      
      
    } catch (\Throwable $th) {
      
     // print_r($th);
      
      debug($th);
    }
  
  }

    static public function send2($to, $subject = "", $body = "", $queue = false) {
        try {
            $transport = $queue ? self::getSpoolTransport() : self::getSmtpTransport();
            $mailer = new Mailer($transport);
            
            $email = (new Email())
                ->from(self::getFromAddress())
                ->to($to)
                ->subject($subject)
                ->html($body);
            
            return $mailer->send($email);
        } catch (\Throwable $th) {
            error_log('EmailService Error: ' . $th->getMessage());
            return false;
        }
    }

    private static function getSmtpTransport(): TransportInterface {
        $config = \Services\Config::getInstance();
        
        $dsn = sprintf(
            'smtp://%s:%s@%s:%s',
            urlencode($config->get('smtp.user')),
            urlencode($config->get('smtp.pass')),
            $config->get('smtp.host'),
            $config->get('smtp.port')
        );
        
        return Transport::fromDsn($dsn);
    }

    private static function getFromAddress(): string {
        $config = \Services\Config::getInstance();
        return sprintf('%s <%s>', 
            $config->get('smtp.name'), 
            $config->get('smtp.email')
        );
    }

    // Nota: Symfony Mailer no tiene spool nativo, necesitarías implementarlo o usar Messenger
}