<?php

namespace Services;

class Config extends \Services\Singleton {
  private $_config;
  
  protected function __construct() {
	$this->_config = include(__DIR__ . '/../../inc/config.php');
  }
  
  public function get($key) {
	if(isset($this->_config[$key])) {
	  return $this->_config[$key];
	}
	return false;
  }
}
