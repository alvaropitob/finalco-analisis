import React from 'react';
import { NumericFormat } from 'react-number-format';

export default function NumberInput({ 
  value, 
  onChange, 
  name, 
  className, 
  allowNegative = false, 
  isCurrency = false,
  decimalScale,
  ...props 
}) {
  return (
    <NumericFormat
      className={className}
      value={value === 0 && !isCurrency && !props.showZero ? '' : value}
      onValueChange={(values) => {
        const { floatValue } = values;
        if (onChange) {
          // Provide an event-like object for compatibility with (e) => setX(e.target.value)
          onChange({
            target: {
              name: name,
              value: floatValue === undefined ? '' : floatValue
            }
          });
        }
      }}
      thousandSeparator="."
      decimalSeparator=","
      prefix={isCurrency ? '$' : ''}
      allowNegative={allowNegative}
      decimalScale={decimalScale}
      {...props}
    />
  );
}
