import React, { ReactNode } from 'react';
import { ChatContextType } from '../../common/type';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import Loading from './Loading';
import classNames from 'classnames';
import { prefixCls } from './ParseTipUtils';

type Props = {
  parseLoading: boolean;
  parseTip: string;
  currentParseInfo?: ChatContextType;
  parseTimeCost?: number;
  isDeveloper?: boolean;
};

const ParseTip: React.FC<Props> = ({
  parseLoading,
  parseTip,
  currentParseInfo,
  parseTimeCost,
  isDeveloper,
}) => {
  const getNode = (tipTitle: ReactNode, tipNode?: ReactNode, failed?: boolean) => {
    return (
      <div className={`${prefixCls}-parse-tip`}>
        <div className={`${prefixCls}-title-bar`}>
          {!failed ? (
            <CheckCircleFilled className={`${prefixCls}-step-icon`} />
          ) : (
            <CloseCircleFilled className={`${prefixCls}-step-error-icon`} />
          )}
          <div className={`${prefixCls}-step-title`}>
            {tipTitle}
            {tipNode === undefined && <Loading />}
          </div>
        </div>
        {(tipNode || tipNode === null) && (
          <div
            className={classNames(
              `${prefixCls}-content-container`,
              tipNode === null && `${prefixCls}-empty-content-container`,
              failed && `${prefixCls}-content-container-failed`
            )}
          >
            {tipNode}
          </div>
        )}
      </div>
    );
  };

  if (parseLoading) {
    return getNode('意图解析中');
  }

  if (parseTip) {
    return getNode(
      <>
        意图解析失败
        {!!parseTimeCost && isDeveloper && (
          <span className={`${prefixCls}-title-tip`}>(耗时: {parseTimeCost}ms)</span>
        )}
      </>,
      parseTip,
      true
    );
  }

  const {
    queryMode,
  } = currentParseInfo || {};

  const tipNode = null;

  return getNode(
    <div className={`${prefixCls}-title-bar`}>
      <div>
        意图解析
        {!!parseTimeCost && isDeveloper && (
          <span className={`${prefixCls}-title-tip`}>(耗时: {parseTimeCost}ms)</span>
        )}
      </div>
    </div>,
    queryMode === 'PLAIN_TEXT' ? null : tipNode
  );
};

export default ParseTip;
