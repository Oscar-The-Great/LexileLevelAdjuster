from openai import OpenAI
from typing import Dict, Optional
import logging
from pathlib import Path

class DeepSeek:
    def __init__(self, config: Dict):
        """
        Initialize DeepSeek with configuration
        
        Args:
            config: Dictionary containing configuration settings
        """
        self.config = config
        self._setup_logging()
        self._validate_config()
        
        # Initialize OpenAI client
        self.client = OpenAI(
            api_key=self.config['settings']['api_key'],
            base_url=self.config['settings'].get('api_endpoint', 'https://api.deepseek.com')
        )
    
    def _setup_logging(self):
        """Set up logging based on configuration"""
        log_level = self.config['logging'].get('log_level', 'info').upper()
        log_file = self.config['logging'].get('log_file', './logs/deepseek.log')
        
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        
        logging.basicConfig(
            level=getattr(logging, log_level, logging.INFO),
            filename=log_file,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
    
    def _validate_config(self):
        """Validate the configuration"""
        required_sections = ['settings', 'parameters']
        for section in required_sections:
            if section not in self.config:
                raise ValueError(f"Missing required config section: {section}")
        
        if 'api_key' not in self.config['settings']:
            raise ValueError("Missing required setting: api_key")
    
    def chat_completion(self, messages: list, **kwargs) -> Optional[str]:
        """
        Generate chat completion using OpenAI API
        
        Args:
            messages: List of message dictionaries
            **kwargs: Additional parameters to override config
            
        Returns:
            Generated response or None if failed
        """
        try:
            params = {
                'model': 'deepseek-chat',
                'messages': messages,
                'temperature': self.config['parameters'].get('temperature', 0.7),
                'max_tokens': self.config['parameters'].get('max_tokens', 1000),
                'top_p': self.config['parameters'].get('top_p', 0.9),
                'stream': False,
                **kwargs
            }
            
            response = self.client.chat.completions.create(**params)
            
            self.logger.info(f"Generated chat completion for {len(messages)} messages")
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            self.logger.error(f"Error in chat completion: {str(e)}")
            return None

# Example usage
if __name__ == "__main__":
    config = {
        'settings': {
            'api_key': 'sk-4f71f7b2b6c246f0a6392acae42c0ed1',
            'api_endpoint': 'https://api.deepseek.com/'
        },
        'parameters': {
            'temperature': 0.7,
            'max_tokens': 1000,
            'top_p': 0.9
        },
        'logging': {
            'log_level': 'info',
            'log_file': './logs/deepseek.log'
        }
    }
    
    deepseek = DeepSeek(config)
    
    # Chat completion example
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Who won the world series in 2020?"}
    ]
    response = deepseek.chat_completion(messages)
    print(response)