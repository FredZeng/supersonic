import {
  ChatContextType,
  MsgDataType,
  ParseStateEnum,
  ParseTimeCostType,
} from '../../common/type';
import React, { createContext, useEffect, useState } from 'react';
import { chatExecute, chatParse, deleteQuery } from '../../service';
import { PARSE_ERROR_TIP, PREFIX_CLS, SEARCH_EXCEPTION_TIP } from '../../common/constants';
import { message } from 'antd';
import IconFont from '../IconFont';
import ParseTip from './ParseTip';
import ExecuteItem from './ExecuteItem';
import classNames from 'classnames';
import Tools from '../Tools';
import { AgentType } from '../../Chat/type';
import dayjs from 'dayjs';
import { exportCsvFile } from '../../utils/utils';
import { useMethodRegister } from '../../hooks';

type Props = {
  msg: string;
  conversationId?: number;
  questionId?: number;
  modelId?: number;
  agentId?: number;
  score?: number;
  filter?: any[];
  parseInfos?: ChatContextType[];
  parseTimeCostValue?: ParseTimeCostType;
  msgData?: MsgDataType;
  triggerResize?: boolean;
  isDeveloper?: boolean;
  currentAgent?: AgentType;
  isLastMessage?: boolean;
  onMsgDataLoaded?: (data: MsgDataType, valid: boolean, isRefresh?: boolean) => void;
  onUpdateMessageScroll?: () => void;
  onSendMsg?: (msg: string) => void;
};

export const ChartItemContext = createContext({
  register: (...args: any[]) => {},
  call: (...args: any[]) => {},
});

const ChatItem: React.FC<Props> = ({
  msg,
  conversationId,
  questionId,
  modelId,
  agentId,
  score,
  filter,
  parseInfos,
  parseTimeCostValue,
  msgData,
  triggerResize,
  isDeveloper,
  currentAgent,
  isLastMessage,
  onMsgDataLoaded,
  onUpdateMessageScroll,
  onSendMsg,
}) => {
  const [parseLoading, setParseLoading] = useState(false);
  const [parseTimeCost, setParseTimeCost] = useState<ParseTimeCostType>();
  const [parseInfo, setParseInfo] = useState<ChatContextType>();
  const [parseTip, setParseTip] = useState('');
  const [executeMode, setExecuteMode] = useState(false);
  const [preParseMode, setPreParseMode] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [executeTip, setExecuteTip] = useState('');
  const [executeErrorMsg, setExecuteErrorMsg] = useState('');
  const [data, setData] = useState<MsgDataType>();

  const resetState = () => {
    setParseLoading(false);
    setParseTimeCost(undefined);
    setParseInfo(undefined);
    setPreParseMode(false);
    setParseTip('');
    setExecuteMode(false);
    setData(undefined);
    setExecuteErrorMsg('');
  };

  const prefixCls = `${PREFIX_CLS}-item`;

  const updateData = (res: Result<MsgDataType>) => {
    let tip: string = '';
    let data: MsgDataType | undefined = undefined;
    const { queryColumns, queryResults, queryState, queryMode, response, errorMsg } = res.data || {};
    setExecuteErrorMsg(errorMsg);
    if (res.code === 400 || res.code === 401 || res.code === 412) {
      tip = res.msg;
    } else if (res.code !== 200) {
      tip = SEARCH_EXCEPTION_TIP;
    } else if (queryState !== 'SUCCESS') {
      tip = response && typeof response === 'string' ? response : SEARCH_EXCEPTION_TIP;
    } else if (
      (queryColumns && queryColumns.length > 0 && queryResults) ||
      queryMode === 'WEB_PAGE' ||
      queryMode === 'WEB_SERVICE' ||
      queryMode === 'PLAIN_TEXT'
    ) {
      data = res.data;
      tip = '';
    }
    if (data) {
      setData(data);
      setExecuteTip('');
      return true;
    }
    setExecuteTip(tip || SEARCH_EXCEPTION_TIP);
    return false;
  };

  const onExecute = async (
    parseInfoValue: ChatContextType,
    parseInfos?: ChatContextType[],
    isRefresh = false
  ) => {
    setExecuteMode(true);
    setExecuteLoading(true);
    try {
      const res: any = await chatExecute(msg, conversationId!, parseInfoValue, agentId);
      const valid = updateData(res);
      onMsgDataLoaded?.(
        {
          ...res.data,
          parseInfos,
          queryId: parseInfoValue.queryId,
        },
        valid,
        isRefresh
      );
    } catch (e) {
      setExecuteTip(SEARCH_EXCEPTION_TIP);
    }
    setExecuteLoading(false);
  };

  const sendMsg = async () => {
    setParseLoading(true);
    const parseData: any = await chatParse({
      queryText: msg,
      chatId: conversationId,
      modelId,
      agentId,
      filters: filter,
    });
    setParseLoading(false);
    const { code, data } = parseData || {};
    const { state, selectedParses, candidateParses, queryId, parseTimeCost, errorMsg } = data || {};
    const parses = selectedParses?.concat(candidateParses || []) || [];
    if (
      code !== 200 ||
      state === ParseStateEnum.FAILED ||
      !parses.length ||
      (!parses[0]?.properties?.type && !parses[0]?.queryMode)
    ) {
      setParseTip(state === ParseStateEnum.FAILED && errorMsg ? errorMsg : PARSE_ERROR_TIP);

      setParseInfo({ queryId } as any);
      return;
    }
    onUpdateMessageScroll?.();
    const parseInfos = parses.slice(0, 5).map((item: any) => ({
      ...item,
      queryId,
    }));
    if (parseInfos.length > 1) {
      setPreParseMode(true);
    }
    const parseInfoValue = parseInfos[0];
    if (!(currentAgent?.enableFeedback === 1 && parseInfos.length > 1)) {
      setParseInfo(parseInfoValue);
    }
    setParseTimeCost(parseTimeCost);
    if (parseInfos.length === 1) {
      onExecute(parseInfoValue, parseInfos);
    }
  };

  const initChatItem = (msg, msgData) => {
    if (msgData) {
      const parseInfoOptionsValue =
        parseInfos && parseInfos.length > 0
          ? parseInfos.map(item => ({ ...item, queryId: msgData.queryId }))
          : [{ ...msgData.chatContext, queryId: msgData.queryId }];
      const parseInfoValue = parseInfoOptionsValue[0];
      setParseInfo(parseInfoValue);
      setParseTimeCost(parseTimeCostValue);
      setExecuteMode(true);
      updateData({ code: 200, data: msgData, msg: 'success' });
    } else if (msg) {
      sendMsg();
    }
  };

  useEffect(() => {
    if (data !== undefined || executeTip !== '' || parseLoading) {
      return;
    }
    initChatItem(msg, msgData);
  }, [msg, msgData]);

  const deleteQueryInfo = async (queryId: number) => {
    const { code }: any = await deleteQuery(queryId);
    if (code === 200) {
      resetState();
      initChatItem(msg, undefined);
    }
  };

  const onExportData = () => {
    const { queryColumns, queryResults } = data || {};
    if (!!queryResults) {
      const exportData = queryResults.map(item => {
        return Object.keys(item).reduce((result, key) => {
          const columnName = queryColumns?.find(column => column.nameEn === key)?.name || key;
          result[columnName] = item[key];
          return result;
        }, {});
      });
      exportCsvFile(exportData);
    }
  };

  const contentClass = classNames(`${prefixCls}-content`);

  const { register, call } = useMethodRegister(() => message.error('该条消息暂不支持该操作'));

  return (
    <ChartItemContext.Provider value={{ register, call }}>
      <div className={prefixCls}>
        <IconFont type="icon-zhinengsuanfa" className={`${prefixCls}-avatar`}/>
        <div>
          <div className={`${prefixCls}-time`}>
            {parseTimeCost?.parseStartTime
              ? dayjs(parseTimeCost.parseStartTime).format('M月D日 HH:mm')
              : ''}
          </div>
          <div className={contentClass}>
            <>
              {!preParseMode && (
                <ParseTip
                  parseLoading={parseLoading}
                  parseTip={parseTip}
                  currentParseInfo={parseInfo}
                  parseTimeCost={parseTimeCost?.parseTime}
                  isDeveloper={isDeveloper}
                />
              )}
            </>

            {executeMode && (
              <div style={{ minHeight: 50 }}>
                <ExecuteItem
                  queryId={parseInfo?.queryId}
                  question={msg}
                  queryMode={parseInfo?.queryMode}
                  executeLoading={executeLoading}
                  executeTip={executeTip}
                  executeErrorMsg={executeErrorMsg}
                  data={data}
                  triggerResize={triggerResize}
                  isDeveloper={isDeveloper}
                />
              </div>
            )}
          </div>
          {(parseTip !== '' || (executeMode && !executeLoading)) &&
            parseInfo?.queryMode !== 'PLAIN_TEXT' && (
              <Tools
                isLastMessage={isLastMessage}
                queryId={parseInfo?.queryId || 0}
                scoreValue={score}
                onExportData={() => {
                  onExportData();
                }}
                onReExecute={queryId => {
                  deleteQueryInfo(queryId);
                }}
              />
            )}
        </div>
      </div>
    </ChartItemContext.Provider>
  );
};

export default ChatItem;
